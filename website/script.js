// EVOS Browser Landing Page JavaScript

// Download URLs - Update these with actual download links
const downloadUrls = {
    windows: 'https://github.com/AhirTech1/evos-browser/releases/latest/download/EVOS-Browser-Setup-1.0.0.exe',
    mac: 'https://github.com/AhirTech1/evos-browser/releases/latest/download/EVOS-Browser-1.0.0.dmg',
    linux: 'https://github.com/AhirTech1/evos-browser/releases/latest/download/EVOS-Browser-1.0.0.AppImage'
};

// Handle download button clicks
function downloadFile(platform) {
    const url = downloadUrls[platform];

    if (url) {
        // Track download (you can add analytics here)
        console.log(`Downloading EVOS Browser for ${platform}`);

        // Open download in new tab
        window.open(url, '_blank');
    } else {
        alert('Download link not available yet. Please check back later!');
    }
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background on scroll
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Add/remove solid background based on scroll position
    if (currentScroll > 50) {
        navbar.style.background = 'rgba(10, 10, 15, 0.95)';
    } else {
        navbar.style.background = 'rgba(10, 10, 15, 0.8)';
    }

    lastScroll = currentScroll;
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe feature cards and download cards
document.querySelectorAll('.feature-card, .download-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
});

// Add animation styles dynamically
const style = document.createElement('style');
style.textContent = `
  .animate-in {
    animation: fadeInUp 0.6s ease forwards;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .feature-card:nth-child(1) { animation-delay: 0s; }
  .feature-card:nth-child(2) { animation-delay: 0.1s; }
  .feature-card:nth-child(3) { animation-delay: 0.2s; }
  .feature-card:nth-child(4) { animation-delay: 0.3s; }
  .feature-card:nth-child(5) { animation-delay: 0.4s; }
  .feature-card:nth-child(6) { animation-delay: 0.5s; }
  
  .download-card:nth-child(1) { animation-delay: 0s; }
  .download-card:nth-child(2) { animation-delay: 0.15s; }
  .download-card:nth-child(3) { animation-delay: 0.3s; }
`;
document.head.appendChild(style);

// Detect OS and highlight recommended download
function detectOS() {
    // OS detection removed - no longer showing "Recommended" badge
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    // Simulate AI typing in mockup
    setTimeout(() => {
        const aiMessage = document.querySelector('.message.ai');
        if (aiMessage) {
            aiMessage.innerHTML = 'This page discusses AI-powered browsers and their features...';
        }
    }, 3000);

    // Make mockup tabs interactive
    const tabs = document.querySelectorAll('.mockup-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
});

// Add parallax effect to hero background
window.addEventListener('mousemove', (e) => {
    const heroImage = document.querySelector('.hero-image');
    if (heroImage && window.innerWidth > 900) {
        const x = (e.clientX - window.innerWidth / 2) / 50;
        const y = (e.clientY - window.innerHeight / 2) / 50;
        heroImage.style.transform = `translate(${x}px, ${y}px)`;
    }
});
