# Music Producer Portfolio Website

A professional, responsive portfolio website for music producers and composers, inspired by modern portfolio designs.

## 🎵 Features

- **Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- **Modern UI/UX** - Clean, minimalist design with smooth animations
- **Audio Reels Section** - Showcase your music with SoundCloud embeds
- **Portfolio Showcase** - Display your work with YouTube/Vimeo video embeds
- **Mobile Navigation** - Hamburger menu for mobile devices
- **Smooth Scrolling** - Enhanced user experience with smooth page transitions
- **SEO Optimized** - Semantic HTML structure for better search engine visibility
- **Fast Loading** - Optimized performance with lazy loading support

## 📁 Project Structure

```
music-portfolio/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All styling
├── js/
│   └── script.js       # Interactive functionality
├── images/
│   ├── hero-bg.jpg     # Hero section background
│   ├── cinematic-reel.jpg
│   ├── organic-reel.jpg
│   └── bandmatic-reel.jpg
└── README.md           # This file
```

## 🚀 Getting Started

1. **Download/Clone** this project to your computer
2. **Open** `index.html` in your web browser to view the site
3. **Customize** the content following the guide below

## ✏️ Customization Guide

### 1. Personal Information

**Edit `index.html`** - Update these sections:

```html
<!-- Line 7: Page Title -->
<title>Your Name | Music Producer & Composer</title>

<!-- Lines 17-18: Navigation Brand -->
<a href="#home">YOUR NAME</a>

<!-- Lines 31-36: Hero Section -->
<h1 class="hero-title">YOUR NAME</h1>
<p class="hero-subtitle">AWARD WINNING</p>
<p class="hero-description">MUSIC PRODUCER & COMPOSER</p>
<p class="hero-location">Based in Your Location</p>
```

### 2. Adding Your Audio Reels

**SoundCloud Embeds:**

1. Go to your track on SoundCloud
2. Click "Share" → "Embed"
3. Copy the iframe code
4. Replace the placeholder iframes in `index.html` (lines 58, 78, 98)

Example:
```html
<iframe width="100%" height="166" scrolling="no" frameborder="no" 
    src="YOUR_SOUNDCLOUD_EMBED_URL">
</iframe>
```

**Update Track Lists:**
- Edit lines 62-66 (Cinematic tracks)
- Edit lines 82-86 (Organic tracks)
- Edit lines 102-106 (Bandmatic tracks)

### 3. Adding Your Video Projects

**YouTube/Vimeo Embeds:**

1. Get your video ID from YouTube (e.g., `dQw4w9WgXcQ` from `youtube.com/watch?v=dQw4w9WgXcQ`)
2. Replace `YOUR_VIDEO_ID` in the iframe src (lines 125, 143, 161, 179, 197, 215)

Example:
```html
<iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
    frameborder="0" allowfullscreen>
</iframe>
```

**Update Project Information:**
- Edit project titles (e.g., line 131: `<h3 class="project-title">`)
- Edit project descriptions (e.g., line 132: `<p class="project-description">`)

### 4. Images

Replace placeholder images in the `images/` folder:

- **hero-bg.jpg** - Hero section background (recommended: 1920x1080px or larger)
- **cinematic-reel.jpg** - Cinematic reel cover (recommended: 600x600px)
- **organic-reel.jpg** - Organic reel cover (recommended: 600x600px)
- **bandmatic-reel.jpg** - Bandmatic reel cover (recommended: 600x600px)

### 5. Contact Information

**Edit `index.html`** (lines 233-245):

```html
<!-- Email -->
<a href="mailto:your.email@example.com" class="contact-link">
    your.email@example.com
</a>

<!-- Social Links -->
<a href="YOUR_SOUNDCLOUD_URL" class="social-link">SoundCloud</a>
<a href="YOUR_YOUTUBE_URL" class="social-link">YouTube</a>
<a href="YOUR_INSTAGRAM_URL" class="social-link">Instagram</a>
<a href="YOUR_LINKEDIN_URL" class="social-link">LinkedIn</a>
```

### 6. Color Scheme

**Edit `css/styles.css`** (lines 12-18) to change colors:

```css
:root {
    --primary-bg: #1a1a1a;        /* Main background */
    --secondary-bg: #2a2a2a;      /* Section backgrounds */
    --accent-color: #d4a574;      /* Accent/highlight color */
    --text-primary: #ffffff;      /* Main text */
    --text-secondary: #b0b0b0;    /* Secondary text */
    --text-muted: #808080;        /* Muted text */
}
```

### 7. Fonts

The site uses Google Fonts (Montserrat & Playfair Display). To change fonts:

1. Visit [Google Fonts](https://fonts.google.com/)
2. Select your fonts
3. Replace the font link in `index.html` (line 10)
4. Update font variables in `css/styles.css` (lines 20-21)

## 🎨 Customization Tips

### Adding More Projects

Copy a project block from `index.html` (lines 118-140) and paste it before the closing `</div>` of the portfolio section. Update the content accordingly.

### Changing Section Order

Simply cut and paste entire `<section>` blocks in `index.html` to reorder them.

### Removing Sections

Delete the entire `<section>` block you don't need and update navigation links accordingly.

### Adding New Sections

1. Create a new `<section id="your-section">` in `index.html`
2. Add corresponding styles in `css/styles.css`
3. Add navigation link in the header menu

## 📱 Responsive Breakpoints

The site is optimized for:
- **Mobile**: 320px - 480px
- **Tablet**: 481px - 768px
- **Desktop**: 769px - 1440px
- **Large Desktop**: 1441px+

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🚀 Deployment

### Option 1: GitHub Pages (Free)
1. Create a GitHub repository
2. Upload all files
3. Go to Settings → Pages
4. Select main branch
5. Your site will be live at `username.github.io/repository-name`

### Option 2: Netlify (Free)
1. Create account at [Netlify](https://www.netlify.com/)
2. Drag and drop your `music-portfolio` folder
3. Your site will be live instantly

### Option 3: Traditional Web Hosting
1. Upload all files via FTP to your web host
2. Ensure `index.html` is in the root directory

## 📝 SEO Tips

1. **Update Meta Description** (line 6 in `index.html`)
2. **Add Alt Text** to images
3. **Use Descriptive Titles** for projects
4. **Add Schema Markup** for better search visibility
5. **Create a sitemap.xml**

## 🔧 Troubleshooting

### Videos Not Loading
- Check that video IDs are correct
- Ensure videos are set to "Public" or "Unlisted"
- Verify embed permissions are enabled

### SoundCloud Not Playing
- Confirm track is public
- Check embed code is complete
- Verify SoundCloud API is accessible

### Mobile Menu Not Working
- Ensure `script.js` is properly linked
- Check browser console for JavaScript errors
- Clear browser cache

### Images Not Displaying
- Verify image file paths are correct
- Check image file names match HTML references
- Ensure images are in the `images/` folder

## 📄 License

This template is free to use for personal and commercial projects.

## 🤝 Support

For questions or issues:
1. Check this README thoroughly
2. Review the code comments in HTML, CSS, and JS files
3. Test in different browsers

## 🎯 Next Steps

1. ✅ Replace all placeholder content with your information
2. ✅ Add your actual audio and video embeds
3. ✅ Upload your images
4. ✅ Test on multiple devices
5. ✅ Deploy to your hosting platform
6. ✅ Share your portfolio with the world!

---

**Built with ❤️ for music producers and composers**