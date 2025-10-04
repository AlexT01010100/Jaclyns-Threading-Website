// ===============================================
// ANIMATIONS JAVASCRIPT
// Handles scroll-based animations and interactions
// ===============================================

document.addEventListener('DOMContentLoaded', function() {
    // Intersection Observer for scroll reveal animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: unobserve after animation to improve performance
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all scroll-reveal elements
    const scrollRevealElements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right');
    scrollRevealElements.forEach(el => observer.observe(el));

    // Add smooth parallax effect to images on scroll
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                handleParallax();
                ticking = false;
            });
            ticking = true;
        }
    });

    function handleParallax() {
        const parallaxElements = document.querySelectorAll('.parallax');
        const scrolled = window.pageYOffset;

        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    }

    // Add staggered animation to review cards
    const reviewCards = document.querySelectorAll('.review-card');
    reviewCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });

    // Enhanced button ripple effect
    const buttons = document.querySelectorAll('button, .booking-button-homepage, .learn-more-button, .learn-more-button-reversed, .contact-button-footer-gallery');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== 'javascript:void(0);') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Add hover effect to navigation links
    const navLinks = document.querySelectorAll('.navbar-menu a');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Gallery image lazy load animation
    const galleryImages = document.querySelectorAll('.gallery-item img');
    galleryImages.forEach(img => {
        img.addEventListener('load', function() {
            this.parentElement.classList.add('fade-in');
        });
    });

    // Add entrance animation to sections as they appear
    const sections = document.querySelectorAll('.info-section, .info-section-reversed, .reviews-section, .contact-location');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // Animate star ratings on hover
    const stars = document.querySelectorAll('.review-rating .star');
    stars.forEach((star, index) => {
        star.addEventListener('mouseenter', function() {
            // Highlight all stars up to and including this one
            for (let i = 0; i <= index; i++) {
                if (stars[i]) {
                    stars[i].style.transform = 'scale(1.2)';
                }
            }
        });
        
        star.parentElement.addEventListener('mouseleave', function() {
            // Reset all stars
            stars.forEach(s => {
                s.style.transform = 'scale(1)';
            });
        });
    });

    // Add floating animation to specific elements (only homepage booking button)
    const floatingElements = document.querySelectorAll('.booking-button-homepage');
    floatingElements.forEach((element, index) => {
        element.style.animation = `float 3s ease-in-out ${index * 0.5}s infinite`;
    });

    // Navbar scroll effect
    let lastScroll = 0;
    const header = document.querySelector('.header');
    
    if (header) {
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 100) {
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
            } else {
                header.style.boxShadow = 'none';
            }
            
            lastScroll = currentScroll;
        });
    }

    // Add glow effect to important buttons
    const importantButtons = document.querySelectorAll('.booking-button-homepage');
    importantButtons.forEach(btn => {
        btn.classList.add('glow-on-hover');
    });

    // Preload animations for faster page transitions
    setTimeout(() => {
        document.body.style.overflow = 'visible';
    }, 100);

    // Add CSS for ripple effect dynamically
    const style = document.createElement('style');
    style.textContent = `
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Console log for debugging
    console.log('✨ Animations initialized successfully!');
});

// Add page transition effect
window.addEventListener('beforeunload', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease-out';
});
