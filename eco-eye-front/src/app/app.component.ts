import { Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackgroundAudioService } from './services/audio.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnDestroy {
    constructor(private backgroundAudioService: BackgroundAudioService) { }

    ngOnDestroy() {
        this.backgroundAudioService.stop();
    }
}