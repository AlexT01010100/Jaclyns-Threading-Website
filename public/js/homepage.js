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

document.addEventListener("DOMContentLoaded", function () {
    const images = document.querySelectorAll(".sliding-image-container img");

    let currentIndex = 0;
    const intervalTime = 3000; // Time between slides in milliseconds
    let slideInterval;

    const nextSlide = () => {
        currentIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
        scrollToImage(currentIndex);
    };

    const scrollToImage = (index) => {
        const container = document.querySelector(".sliding-image-container");
        const image = images[index];
        container.scroll({
            left: image.offsetLeft,
            behavior: 'smooth'
        });
    };

    // Function to check if we should use static display (tablet: 450px+, desktop: 1024px+)
    const shouldUseStaticDisplay = () => {
        return window.innerWidth >= 450;
    };

    // Function to start or stop sliding based on viewport width
    const handleSliding = () => {
        if (shouldUseStaticDisplay()) {
            // Stop auto-scrolling for static display (tablet and desktop)
            if (slideInterval) {
                clearInterval(slideInterval);
                slideInterval = null;
            }
            // Reset scroll position to show all images
            const container = document.querySelector(".sliding-image-container");
            if (container) {
                container.scrollLeft = 0;
            }
        } else {
            // Start auto-scrolling for mobile screens (below 450px)
            if (!slideInterval && images.length > 1) {
                slideInterval = setInterval(nextSlide, intervalTime);
            }
        }
    };

    // Initial check
    handleSliding();

    // Listen for window resize to toggle between sliding and static
    window.addEventListener('resize', handleSliding);

    // Allow clicking on images to scroll to them (only when not in static mode)
    images.forEach((img, index) => {
        img.addEventListener('click', () => {
            if (!shouldUseStaticDisplay()) {
                currentIndex = index;
                scrollToImage(currentIndex);
                clearInterval(slideInterval);
                slideInterval = setInterval(nextSlide, intervalTime);
            }
        });
    });
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
