//! Ask AI and notes on a miting (doc 20): note cards pinned to moments or to
//! selected transcript text, and a private question-and-answer conversation
//! with the AI the user picked for notes. Answers come only from the meeting
//! and every cited moment is checked against the transcript.

pub mod commands;
pub mod notes_commands;
pub mod types;

mod cite;
mod load;
mod plain;
mod prompt;
mod rolling;
mod service;
mod window;
pub mod summary_notes;
