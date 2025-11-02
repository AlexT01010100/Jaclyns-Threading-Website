// Reviews container
document.addEventListener("DOMContentLoaded", function () {
    const reviewsContainer = document.querySelector(".reviews");
    if (reviewsContainer) {
        // Calculate the middle scroll position
        const middleScroll = reviewsContainer.scrollWidth / 2 - reviewsContainer.clientWidth / 2;

        // Scroll to the middle
        reviewsContainer.scrollLeft = middleScroll;
    }
});

// Image Carousel Functionality
document.addEventListener("DOMContentLoaded", function () {
    const container = document.querySelector(".sliding-image-container");
    const images = document.querySelectorAll(".sliding-image-container img");
    const prevButton = document.querySelector(".carousel-nav.prev");
    const nextButton = document.querySelector(".carousel-nav.next");
    
    if (!container || images.length === 0) return;
    
    let currentIndex = 0;
    let autoPlayInterval;
    const autoPlayDelay = 4000; // 4 seconds between auto-slides
    
    // Get number of visible images based on screen width
    function getVisibleCount() {
        const width = window.innerWidth;
        if (width >= 1024) return 3; // Desktop: 3 images
        if (width >= 768) return 2;  // Tablet: 2 images
        return 1;                      // Mobile: 1 image
    }
    
    // Get maximum index we can slide to
    function getMaxIndex() {
        return images.length - getVisibleCount();
    }
    
    // Update carousel position
    function updateCarousel(animate = true) {
        const visibleCount = getVisibleCount();
        const maxIndex = getMaxIndex();
        
        // Ensure currentIndex is within bounds
        if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
        }
        if (currentIndex < 0) {
            currentIndex = 0;
        }
        
        const imageWidth = images[0].offsetWidth;
        const offset = -(currentIndex * imageWidth);
        
        if (animate) {
            container.style.transition = 'transform 0.5s ease-in-out';
        } else {
            container.style.transition = 'none';
        }
        
        container.style.transform = `translateX(${offset}px)`;
        
        // Update button states
        updateButtonStates();
    }
    
    // Update button visibility/state
    function updateButtonStates() {
        const maxIndex = getMaxIndex();
        
        // Always show and enable buttons for continuous looping
        if (prevButton) {
            prevButton.style.display = maxIndex > 0 ? 'block' : 'none';
            prevButton.disabled = false;
            prevButton.style.opacity = '1';
        }
        
        if (nextButton) {
            nextButton.style.display = maxIndex > 0 ? 'block' : 'none';
            nextButton.disabled = false;
            nextButton.style.opacity = '1';
        }
    }
    
    // Navigation functions
    function slideNext() {
        const maxIndex = getMaxIndex();
        if (currentIndex < maxIndex) {
            currentIndex++;
            updateCarousel();
        } else {
            // Loop back to start
            currentIndex = 0;
            updateCarousel();
        }
    }
    
    function slidePrev() {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        } else {
            // Loop to end
            currentIndex = getMaxIndex();
            updateCarousel();
        }
    }
    
    // Auto-play functionality
    function startAutoPlay() {
        stopAutoPlay(); // Clear any existing interval first
        autoPlayInterval = setInterval(slideNext, autoPlayDelay);
    }
    
    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        }
    }
    
    // Event listeners for navigation buttons
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            slideNext();
            startAutoPlay(); // Restart the timer
        });
    }
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            slidePrev();
            startAutoPlay(); // Restart the timer
        });
    }
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateCarousel(false);
            startAutoPlay(); // Ensure auto-play continues after resize
        }, 250);
    });
    
    // Pause auto-play on hover, resume on mouse leave
    const carouselWrapper = document.querySelector('.carousel-wrapper');
    if (carouselWrapper) {
        carouselWrapper.addEventListener('mouseenter', () => {
            stopAutoPlay();
        });
        carouselWrapper.addEventListener('mouseleave', () => {
            startAutoPlay();
        });
    }
    
    // Initialize carousel and start auto-play
    updateCarousel(false);
    startAutoPlay();
});

// Load Google Reviews for Homepage
async function loadHomepageReviews() {
    const loadingEl = document.getElementById('loading-reviews-homepage');
    const containerEl = document.getElementById('reviews-container-homepage');
    const overallStarsEl = document.getElementById('overall-stars-homepage');
    const ratingTextEl = document.getElementById('rating-text-homepage');
    
    try {
        const response = await fetch('/api/reviews');
        
        if (!response.ok) {
            throw new Error('Failed to fetch reviews');
        }
        
        const placeData = await response.json();
        
        if (placeData && placeData.rating) {
            const reviews = placeData.reviews || [];
            
            // Update overall rating
            overallStarsEl.innerHTML = generateStarsHomepage(placeData.rating);
            ratingTextEl.textContent = `${placeData.rating} stars from ${placeData.user_ratings_total || 0} reviews`;
            
            // Hide loading
            loadingEl.style.display = 'none';
            
            if (reviews.length > 0) {
                // Show only first 3 reviews on homepage
                const reviewsToShow = reviews.slice(0, 3);
                
                let reviewsHTML = '';
                reviewsToShow.forEach(review => {
                    reviewsHTML += createReviewCardHomepage(review);
                });
                
                containerEl.innerHTML = reviewsHTML;
            }
        }
    } catch (error) {
        console.error('Error loading homepage reviews:', error);
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '<p style="text-align: center; color: #666;">Reviews coming soon!</p>';
    }
}

function generateStarsHomepage(rating) {
    let starsHTML = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<span class="star">&#9733;</span>';
    }
    
    if (hasHalfStar) {
        starsHTML += '<span class="star half">&#9733;</span>';
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<span class="star empty">&#9734;</span>';
    }
    
    return starsHTML;
}

function createReviewCardHomepage(review) {
    const authorName = review.author_name || 'Anonymous';
    const rating = review.rating || 0;
    const text = review.text || 'No review text provided.';
    const photoUrl = review.profile_photo_url || null;
    
    // Truncate long reviews
    const truncatedText = text.length > 150 ? text.substring(0, 150) + '...' : text;
    
    return `
        <div class="review-card">
            <div class="review-header">
                ${photoUrl 
                    ? `<img src="${photoUrl}" alt="${authorName}" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 15px;">`
                    : `<div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #c2a76b, #8b7355); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 15px;">${authorName[0]}</div>`
                }
                <div class="review-info">
                    <h3>${authorName}</h3>
                    <div class="review-rating">
                        ${generateStarsHomepage(rating)}
                    </div>
                </div>
            </div>
            <p class="review-text">${truncatedText}</p>
        </div>
    `;
}

// Load reviews when page loads
if (document.getElementById('reviews-container-homepage')) {
    loadHomepageReviews();
}
