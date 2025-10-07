function fadeInOnScroll() {
    const galleryItems = document.querySelectorAll(".gallery-item");
    galleryItems.forEach((item) => {
        const itemTop = item.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (itemTop < windowHeight) {
            item.classList.add("fade-in");
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const galleryItems = document.querySelectorAll(".gallery-item");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const gallerySections = document.querySelectorAll(".gallery-section");

    // Initial check on page load
    fadeInOnScroll();

    // Service filter functionality
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const service = button.getAttribute('data-service');
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter sections
            if (service === 'all') {
                gallerySections.forEach(section => {
                    section.classList.remove('hidden');
                });
            } else {
                gallerySections.forEach(section => {
                    if (section.getAttribute('data-service') === service) {
                        section.classList.remove('hidden');
                    } else {
                        section.classList.add('hidden');
                    }
                });
            }
            
            // Re-trigger fade-in effect for visible items
            setTimeout(() => {
                fadeInOnScroll();
            }, 100);
        });
    });

    galleryItems.forEach((item) => {
        item.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event from propagating to parent elements

            if (!item.classList.contains('active')) {
                closeActiveItems(); // Close any previously active item
                item.classList.add('active');
                document.body.classList.add('modal-open');

                // Disable pointer events on all gallery items
                galleryItems.forEach((otherItem) => {
                    otherItem.style.pointerEvents = 'none';
                });
            } else {
                item.classList.remove('active');
                document.body.classList.remove('modal-open');

                // Re-enable pointer events on all gallery items
                galleryItems.forEach((otherItem) => {
                    otherItem.style.pointerEvents = 'auto';
                });
            }
        });
    });

    window.addEventListener("scroll", fadeInOnScroll);

    // Close active item when clicking outside of it
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.gallery-item.active') && document.querySelector('.gallery-item.active')) {
            closeActiveItems();
        }
    });

    function closeActiveItems() {
        const activeItem = document.querySelector('.gallery-item.active');
        if (activeItem) {
            activeItem.classList.remove('active');
            document.body.classList.remove('modal-open');

            // Re-enable pointer events on all gallery items
            galleryItems.forEach((item) => {
                item.style.pointerEvents = 'auto';
            });
        }
    }
    
    // Before/After Slider Functionality
    initializeBeforeAfterSliders();
});

function initializeBeforeAfterSliders() {
    const sliders = document.querySelectorAll('.before-after-slider');
    
    sliders.forEach(slider => {
        const container = slider.closest('.before-after-container');
        const afterImage = slider.querySelector('.after-image');
        const handle = slider.querySelector('.slider-handle');
        let isDragging = false;
        
        // Mouse events
        container.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        // Touch events
        container.addEventListener('touchstart', startDrag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', stopDrag);
        
        function startDrag(e) {
            isDragging = true;
            updateSlider(e);
        }
        
        function drag(e) {
            if (!isDragging) return;
            updateSlider(e);
        }
        
        function stopDrag() {
            isDragging = false;
        }
        
        function updateSlider(e) {
            const rect = container.getBoundingClientRect();
            const x = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
            const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
            
            // Update clip path for after image
            afterImage.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
            
            // Update handle position
            handle.style.left = `${percentage}%`;
        }
    });
}
