import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { UpdateDialog } from "./UpdateDialog";
import { updateService, UpdateInfo } from '@/services/updateService';
import { isBenignUpdateError, toUpdateCheckError } from '@/services/updateErrors';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MitingLogoTile } from './shell/MitingMark';
import { AboutFeatures } from './about/AboutFeatures';

const CREDIT = 'border-b border-dotted border-zinc-300 text-zinc-500 hover:text-zinc-700';

/** Minimal About panel: freedom tagline, feature bullets, update check. */
export function About() {
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [upToDate, setUpToDate] = useState(false);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    useEffect(() => {
        getVersion().then(setCurrentVersion).catch(console.error);
    }, []);

    const openUrl = (url: string) => invoke('open_external_url', { url }).catch(console.error);

    const handleCheckForUpdates = async () => {
        setIsChecking(true);
        setUpToDate(false);
        try {
            const info = await updateService.checkForUpdates(true);
            setUpdateInfo(info);
            if (info.available) {
                setShowUpdateDialog(true);
            } else {
                // Result shows on the button itself — no separate status row.
                setUpToDate(true);
            }
        } catch (error) {
            const failure = toUpdateCheckError(error);
            console.error('Failed to check for updates:', failure.kind, failure.raw);
            // A silent update channel (offline, 404, no build for this platform)
            // is not an app fault — report it the same as "nothing new".
            if (isBenignUpdateError(failure.kind)) {
                setUpToDate(true);
            } else if (failure.kind !== 'in-progress') {
                toast.error(failure.message);
            }
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="px-1 pb-1 pt-2">
            <div className="mx-auto w-fit">
                <MitingLogoTile size={52} radius={14} />
            </div>
            <h2 className="mb-0.5 mt-3 text-center text-[19px] font-semibold tracking-tight text-zinc-900">
                Miting
            </h2>
            {currentVersion && (
                <p className="mb-3.5 text-center text-xs text-zinc-400">Version {currentVersion}</p>
            )}

            <p className="mb-1.5 text-center text-[15px] font-semibold tracking-tight text-zinc-900">
                Built for <span className="text-brand">FREEDOM</span>
            </p>
            <p className="mb-4 text-center text-[13px] leading-relaxed text-zinc-500">
                Your mitings, your machine, your AI. Stop paying every month for an
                AI miting assistant.
            </p>

            <div className="mb-4 flex justify-center gap-2">
                <button
                    type="button"
                    onClick={() => openUrl('https://miting.bigde.li')}
                    className="rounded-[9px] bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-700"
                >
                    Miting website
                </button>
                <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={isChecking}
                    className="inline-flex items-center gap-1.5 rounded-[9px] border border-zinc-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                >
                    {isChecking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {upToDate && <Check className="h-3.5 w-3.5 text-brand" />}
                    {isChecking ? 'Checking…' : upToDate ? "You're up to date" : 'Check for updates'}
                </button>
            </div>

            <AboutFeatures openUrl={openUrl} />

            <p className="text-center text-[11.5px] text-zinc-400">
                by{' '}
                <button type="button" onClick={() => openUrl('https://bigde.li')} className={CREDIT}>
                    Mohamad Bigdeli
                </button>
            </p>
            <UpdateDialog
                open={showUpdateDialog}
                onOpenChange={setShowUpdateDialog}
                updateInfo={updateInfo}
            />
        </div>
    );
}
