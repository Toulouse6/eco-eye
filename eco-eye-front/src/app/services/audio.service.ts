import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BackgroundAudioService {
    private audio = new Audio('assets/audio/nova-notes.mp3');
    private isPlaying = false;

    play() {
        if (!this.isPlaying) {
            this.audio.loop = true;
            this.audio.volume = 0.2;
            this.audio.play().catch(() => {});
            this.isPlaying = true;
        }
    }

    playOnUserGesture() {
        if (this.audio.paused) {
            this.audio.play().catch(() => {});
            this.isPlaying = true;
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
    }
}