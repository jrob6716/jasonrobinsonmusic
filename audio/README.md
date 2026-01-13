# Audio Preview Setup

## Directory Structure
```
audio/
└── previews/
    ├── track1-preview.mp3
    ├── track2-preview.mp3
    ├── track3-preview.mp3
    ├── track4-preview.mp3
    ├── track5-preview.mp3
    ├── track6-preview.mp3
    ├── track7-preview.mp3
    ├── track8-preview.mp3
    ├── track9-preview.mp3
    ├── track10-preview.mp3
    ├── track11-preview.mp3
    └── track12-preview.mp3
```

## How to Add Your Audio Previews

1. **Create 30-second preview clips** of your tracks from PremiumBeat
2. **Export as MP3** files (recommended: 128kbps, 44.1kHz for web optimization)
3. **Name them according to the pattern** above (track1-preview.mp3, track2-preview.mp3, etc.)
4. **Place them in the `audio/previews/` directory**

## Track Mapping

The tracks correspond to the following songs in your portfolio:

- `track1-preview.mp3` → "The Music Feels Better With..."
- `track2-preview.mp3` → "Space Invaders"
- `track3-preview.mp3` → "Alone Tonight"
- `track4-preview.mp3` → "We Are Champions"
- `track5-preview.mp3` → "Electric Horizon"
- `track6-preview.mp3` → "Razorblades"
- `track7-preview.mp3` → "Feel It In The Air"
- `track8-preview.mp3` → "Lost In Echoes"
- `track9-preview.mp3` → "Missed Connection"
- `track10-preview.mp3` → "The Prologue"
- `track11-preview.mp3` → "Under the Disco Moon"
- `track12-preview.mp3` → "Push It to the Limit"

## Legal Considerations

- Ensure you have the rights to use preview clips of your own tracks
- Keep previews to 30 seconds or less
- Consider adding a watermark or lower quality for preview purposes
- Always direct users to PremiumBeat for full licensing

## Alternative Options

If you don't want to host audio files locally, you can:

1. **Use SoundCloud embeds** for your own tracks
2. **Host on a CDN** like AWS S3 or Cloudflare
3. **Use a music streaming service API** that allows previews
4. **Create a simple backend** to serve audio files with proper headers

## File Size Optimization

- Keep preview files under 1MB each for faster loading
- Use MP3 format with 128kbps bitrate
- Consider using audio compression tools
- Implement lazy loading for better performance