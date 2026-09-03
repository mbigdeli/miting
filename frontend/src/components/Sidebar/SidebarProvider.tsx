'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { SUMMARY_STATUS_EVENT, SummaryStatusChanged } from '@/lib/summaryEvents';
import { SummaryWatcher, watchSummary } from './summaryWatcher';


interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: SidebarItem[];
}

export interface CurrentMeeting {
  id: string;
  title: string;
  /** RFC 3339 creation time — present on rows from api_get_meetings. */
  created_at?: string;
}

// Miting: per-meeting processing status for sidebar chips.
export interface MeetingStatus {
  summary_status?: string | null; // null | PENDING | completed | failed | cancelled
  diarized: boolean;
}

// Search result type for transcript search
interface TranscriptSearchResult {
  id: string;
  title: string;
  matchContext: string;
  timestamp: string;
};

interface SidebarContextType {
  currentMeeting: CurrentMeeting | null;
  setCurrentMeeting: (meeting: CurrentMeeting | null) => void;
  sidebarItems: SidebarItem[];
  isCollapsed: boolean;
  toggleCollapse: () => void;
  meetings: CurrentMeeting[];
  setMeetings: (meetings: CurrentMeeting[]) => void;
  // Miting: meeting_id -> processing status (for sidebar chips)
  meetingStatuses: Record<string, MeetingStatus>;
  // Meetings whose transcript-enhancement pass is still running in background.
  enhancingMeetings: Set<string>;
  isMeetingActive: boolean;
  setIsMeetingActive: (active: boolean) => void;
  handleRecordingToggle: () => void;
  searchTranscripts: (query: string) => Promise<void>;
  searchResults: TranscriptSearchResult[];
  isSearching: boolean;
  setServerAddress: (address: string) => void;
  serverAddress: string;
  transcriptServerAddress: string;
  setTranscriptServerAddress: (address: string) => void;
  // Summary progress watching (backend event driven, timer as fallback)
  startSummaryPolling: (meetingId: string, processId: string, onUpdate: (result: any) => void) => void;
  stopSummaryPolling: (meetingId: string) => void;
  // Refetch meetings from backend
  refetchMeetings: () => Promise<void>;

}

const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [currentMeeting, setCurrentMeeting] = useState<CurrentMeeting | null>({ id: 'intro-call', title: '+ New Call' });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [meetings, setMeetings] = useState<CurrentMeeting[]>([]);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [serverAddress, setServerAddress] = useState('');
  const [transcriptServerAddress, setTranscriptServerAddress] = useState('');
  // A ref, not state: keeping watchers in state made every start/stop change
  // the map identity, which re-ran the cleanup effect and killed watchers that
  // were still running for other meetings.
  const summaryWatchers = React.useRef<Map<string, SummaryWatcher>>(new Map());
  const [meetingStatuses, setMeetingStatuses] = useState<Record<string, MeetingStatus>>({});
  const [enhancingMeetings, setEnhancingMeetings] = useState<Set<string>>(new Set());

  // Track background transcript-enhancement passes (list chips + refetch cue).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ meeting_id: string; stage: string }>('transcript-enhancement-progress', (event) => {
      const { meeting_id, stage } = event.payload;
      const terminal = stage === 'completed' || stage === 'skipped' || stage === 'error';
      setEnhancingMeetings((prev) => {
        if (terminal ? !prev.has(meeting_id) : prev.has(meeting_id)) return prev;
        const next = new Set(prev);
        if (terminal) next.delete(meeting_id);
        else next.add(meeting_id);
        return next;
      });
    }).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => unlisten?.();
  }, []);

  // Use recording state from RecordingStateContext (single source of truth)
  const { isRecording } = useRecordingState();

  const pathname = usePathname();
  const router = useRouter();

  // Extract fetchMeetings as a reusable function
  const fetchMeetings = React.useCallback(async () => {
    if (serverAddress) {
      try {
        const meetings = await invoke('api_get_meetings') as Array<{ id: string, title: string, created_at?: string }>;
        const transformedMeetings = meetings.map((meeting: any) => ({
          id: meeting.id,
          title: meeting.title,
          created_at: meeting.created_at
        }));
        setMeetings(transformedMeetings);
        Analytics.trackBackendConnection(true);

        // Miting: batched per-meeting status for sidebar chips (single query).
        try {
          const rows = await invoke('api_get_meetings_status') as Array<{
            meeting_id: string;
            summary_status?: string | null;
            diarized: number;
          }>;
          const map: Record<string, MeetingStatus> = {};
          for (const r of rows) {
            map[r.meeting_id] = { summary_status: r.summary_status, diarized: (r.diarized ?? 0) > 0 };
          }
          setMeetingStatuses(map);
        } catch (statusErr) {
          console.warn('Failed to load meeting statuses:', statusErr);
        }
      } catch (error) {
        console.error('Error fetching meetings:', error);
        setMeetings([]);
        Analytics.trackBackendConnection(false, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }, [serverAddress]);

  useEffect(() => {
    fetchMeetings();
  }, [serverAddress, fetchMeetings]);

  // Summary transitions land on the list chips immediately. The status is
  // written straight into local state — waiting on a full meetings refetch is
  // what made the "Summarized" badge show up seconds late.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<SummaryStatusChanged>(SUMMARY_STATUS_EVENT, (event) => {
      const { meeting_id, status, meeting_name } = event.payload;

      setMeetingStatuses((prev) => {
        const current = prev[meeting_id];
        if (current?.summary_status === status) return prev;
        return {
          ...prev,
          [meeting_id]: { summary_status: status, diarized: current?.diarized ?? false },
        };
      });

      // A completed pass may also have renamed the meeting.
      if (meeting_name) {
        setMeetings((prev) =>
          prev.map((m) => (m.id === meeting_id ? { ...m, title: meeting_name } : m))
        );
      }
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      setServerAddress('http://localhost:5167');
      setTranscriptServerAddress('http://127.0.0.1:8178/stream');
    };
    fetchSettings();
  }, []);

  const baseItems: SidebarItem[] = [
    {
      id: 'meetings',
      title: 'Miting Notes',
      type: 'folder' as const,
      children: [
        ...meetings.map(meeting => ({ id: meeting.id, title: meeting.title, type: 'file' as const }))
      ]
    },
  ];


  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Update current meeting when on home page
  useEffect(() => {
    if (pathname === '/') {
      setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
    }
    setSidebarItems(baseItems);
  }, [pathname]);

  // Update sidebar items when meetings change
  useEffect(() => {
    setSidebarItems(baseItems);
  }, [meetings]);

  // Function to handle recording toggle from sidebar
  const handleRecordingToggle = () => {
    if (!isRecording) {
      // Check if already on home page
      if (pathname === '/') {
        // Already on home - trigger recording directly via custom event
        console.log('Triggering recording from sidebar (already on home page)');
        window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
      } else {
        // Not on home - navigate and use auto-start mechanism
        console.log('Navigating to home page with auto-start flag');
        sessionStorage.setItem('autoStartRecording', 'true');
        router.push('/');
      }

      // Track recording initiation from sidebar
      Analytics.trackButtonClick('start_recording', 'sidebar');
    }
    // The actual recording start/stop is handled in the Home component
  };

  // Function to search through meeting transcripts
  const searchTranscripts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);


      const results = await invoke('api_search_transcripts', { query }) as TranscriptSearchResult[];
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching transcripts:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Summary progress watching: backend event first, timer as a safety net.
  const startSummaryPolling = React.useCallback((
    meetingId: string,
    processId: string,
    onUpdate: (result: any) => void
  ) => {
    summaryWatchers.current.get(meetingId)?.stop();
    console.log(`Watching summary for meeting ${meetingId}, process ${processId}`);

    const watcher = watchSummary(meetingId, (result) => {
      onUpdate(result);
      const status = (result?.status ?? '').toLowerCase();
      if (status !== 'pending' && status !== 'processing' && status !== 'running') {
        summaryWatchers.current.delete(meetingId);
      }
    });

    summaryWatchers.current.set(meetingId, watcher);
  }, []);

  const stopSummaryPolling = React.useCallback((meetingId: string) => {
    const watcher = summaryWatchers.current.get(meetingId);
    if (!watcher) return;
    console.log(`Stopping summary watcher for meeting ${meetingId}`);
    watcher.stop();
    summaryWatchers.current.delete(meetingId);
  }, []);

  // Cleanup every watcher on unmount
  useEffect(() => {
    const watchers = summaryWatchers.current;
    return () => {
      watchers.forEach((watcher) => watcher.stop());
      watchers.clear();
    };
  }, []);



  return (
    <SidebarContext.Provider value={{
      currentMeeting,
      setCurrentMeeting,
      sidebarItems,
      isCollapsed,
      toggleCollapse,
      meetings,
      setMeetings,
      meetingStatuses,
      enhancingMeetings,
      isMeetingActive,
      setIsMeetingActive,
      handleRecordingToggle,
      searchTranscripts,
      searchResults,
      isSearching,
      setServerAddress,
      serverAddress,
      transcriptServerAddress,
      setTranscriptServerAddress,
      startSummaryPolling,
      stopSummaryPolling,
      refetchMeetings: fetchMeetings,

    }}>
      {children}
    </SidebarContext.Provider>
  );
}
