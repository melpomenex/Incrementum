import React, { useEffect } from "react";
import { Mic, Languages, Download, Trash2, CheckCircle2, Loader2, Info, AlertCircle } from "lucide-react";
import { useTranscriptionStore } from "../../stores/useTranscriptionStore";
import { downloadTranscriptionModel, deleteTranscriptionModel } from "../../api/transcription";
import { cn } from "../../utils";

export function AudioTranscriptionSettings() {
  const { profiles, fetchProfiles, downloadProgress, currentStatus } = useTranscriptionStore();

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDownload = async (id: string) => {
    try {
      await downloadTranscriptionModel(id);
      fetchProfiles();
    } catch (error) {
      console.error("Failed to download model:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTranscriptionModel(id);
      fetchProfiles();
    } catch (error) {
      console.error("Failed to delete model:", error);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Local Transcription</h3>
          <p className="text-sm text-muted-foreground">
            Fully offline, high-performance transcription using Whisper
          </p>
        </div>
      </div>

      {/* Model Selection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-semibold text-foreground">Models & Profiles</h4>
        </div>
        
        <div className="grid gap-4">
          {profiles.map((profile) => {
            const progress = downloadProgress[profile.id];
            const isDownloading = progress !== undefined && progress < 100 && currentStatus === 'downloading';
            
            return (
              <div 
                key={profile.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground">{profile.name}</span>
                    {progress === 100 && !isDownloading && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{profile.description}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                    <span>{(profile.size_bytes / 1024 / 1024).toFixed(0)} MB</span>
                    <span>•</span>
                    <span>SHA256: {profile.sha256.substring(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isDownloading ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 text-xs font-medium text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Downloading {Math.round(progress)}%</span>
                      </div>
                      <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : progress === 100 ? (
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload(profile.id)}
                      disabled={currentStatus === 'downloading'}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Info & Requirements */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Info className="w-5 h-5" />
          <h5 className="font-bold">Offline & Private</h5>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Transcription happens entirely on your machine. Your audio files are never sent to any server. 
          The first-time setup requires downloading the models above.
        </p>
        <div className="pt-2 flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Min. 8GB RAM recommended</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>AVX/AVX2 support required</span>
          </div>
        </div>
      </div>
    </div>
  );
}

