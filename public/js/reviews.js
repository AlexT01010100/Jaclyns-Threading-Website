// Google Reviews Integration
// This now calls your server endpoint which handles the Google API
// You need to add GOOGLE_API_KEY to your .env file

// Function to generate star ratings
function generateStars(rating) {
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

// Function to format time ago
function getTimeAgo(timestamp) {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    return 'Recently';
}

// Function to get initials for avatar
function getInitials(name) {
    const names = name.split(' ');
    if (names.length >= 2) {
        return names[0][0] + names[1][0];
    }
    return name[0];
}

// Function to create review card
function createReviewCard(review) {
    const authorName = review.author_name || 'Anonymous';
    const rating = review.rating || 0;
    const text = review.text || 'No review text provided.';
    const time = review.time ? getTimeAgo(review.time) : 'Recently';
    const photoUrl = review.profile_photo_url || null;
    const initials = getInitials(authorName);
    
    return `
        <div class="review-card fade-in">
            <div class="review-header">
                ${photoUrl 
                    ? `<img src="${photoUrl}" alt="${authorName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="avatar-fallback" style="display: none;">${initials}</div>`
                    : `<div class="avatar-fallback">${initials}</div>`
                }
                <div class="review-info">
                    <h3>${authorName}</h3>
                    <div class="review-rating">
                        ${generateStars(rating)}
                    </div>
                    <p class="review-time">${time}</p>
                </div>
            </div>
            <p class="review-text">${text}</p>
        </div>
    `;
}

// Function to load Google Reviews
async function loadGoogleReviews() {
    const loadingEl = document.getElementById('loading-reviews');
    const containerEl = document.getElementById('reviews-container');
    const errorEl = document.getElementById('error-state');
    const overallStarsEl = document.getElementById('overall-stars');
    const ratingTextEl = document.getElementById('rating-text');
    
    try {
        // Call your server endpoint instead of Google API directly
        const response = await fetch('/api/reviews');
        
        if (!response.ok) {
            const errorData = await response.json();
            
            // Check if API key is not configured
            if (errorData.error === 'Google API key not configured') {
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
                errorEl.innerHTML = `
                    <div class="setup-notice">
                        <i class="fas fa-info-circle"></i>
                        <h3>Google Reviews Setup Required</h3>
                        <p>To display live Google reviews, please follow these steps:</p>
                        <ol>
                            <li>Get a Google Places API key from <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
                            <li>Open your <code>.env</code> file</li>
                            <li>Add this line: <code>GOOGLE_API_KEY=your-api-key-here</code></li>
                            <li>Restart your server</li>
                            <li>Refresh this page</li>
                        </ol>
                        <p>See <strong>GOOGLE-REVIEWS-SETUP.md</strong> for detailed instructions.</p>
                        <p>In the meantime, visit our <a href="https://www.google.com/search?gs_ssp=eJzj4tVP1zc0TMs1TTbLKk42YLRSNaiwsEwxNkgyTUpOSgUyDE2tDCoSzcwMLMwNLS2TTQ3M0tKMvCSyEpNzKvPUixVKMopSE1My89IVihNz8vMAnOgYXQ&q=jaclyn%27s+threading+salon" target="_blank">Google Business Profile</a> to see our reviews!</p>
                    </div>
                `;
                return;
            }
            
            throw new Error(errorData.message || 'Failed to fetch reviews');
        }
        
        const placeData = await response.json();
        
        if (placeData && placeData.rating) {
            const reviews = placeData.reviews || [];
            
            // Update overall rating
            overallStarsEl.innerHTML = generateStars(placeData.rating);
            ratingTextEl.textContent = `${placeData.rating} out of 5 stars (${placeData.user_ratings_total || 0} reviews)`;
            
            // Hide loading, show reviews
            loadingEl.style.display = 'none';
            
            if (reviews.length > 0) {
                // Sort reviews by rating (highest first) and recency
                reviews.sort((a, b) => {
                    if (b.rating !== a.rating) return b.rating - a.rating;
                    return (b.time || 0) - (a.time || 0);
                });
                
                // Create review rows (4 reviews per row)
                let reviewsHTML = '<div class="review-row">';
                reviews.forEach((review, index) => {
                    reviewsHTML += createReviewCard(review);
                    
                    // Start new row after every 4 reviews
                    if ((index + 1) % 4 === 0 && index !== reviews.length - 1) {
                        reviewsHTML += '</div><div class="review-row">';
                    }
                });
                reviewsHTML += '</div>';
                
                containerEl.innerHTML = reviewsHTML;
                
                // Show "View All Reviews" button and update count
                const viewAllContainer = document.getElementById('view-all-container');
                const totalReviewsSpan = document.getElementById('total-reviews');
                if (viewAllContainer && totalReviewsSpan) {
                    totalReviewsSpan.textContent = `${placeData.user_ratings_total || 0} total reviews`;
                    viewAllContainer.style.display = 'block';
                }
            } else {
                containerEl.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to leave a review!</p>';
            }
        } else {
            throw new Error('No review data received');
        }
    } catch (error) {
        console.error('Error loading Google reviews:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
    }
}

// Load reviews when page loads
document.addEventListener('DOMContentLoaded', loadGoogleReviews);
