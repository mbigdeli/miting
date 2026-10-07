/**
 * The one way transcription model sizes are shown. Each engine's catalog
 * reports `size_mb` in whole megabytes; Settings and the setup steps both
 * print that number through here so they can never disagree.
 */
export const formatEngineSize = (sizeMb: number): string => `${sizeMb} MB`;
