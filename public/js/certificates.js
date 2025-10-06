// Certificate Lightbox Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Create modal elements
    const modal = document.createElement('div');
    modal.id = 'certificate-modal';
    modal.className = 'certificate-modal';
    modal.innerHTML = `
        <span class="certificate-modal-close">&times;</span>
        <img class="certificate-modal-content" id="modal-image">
        <div class="certificate-modal-caption"></div>
    `;
    document.body.appendChild(modal);

    const modalImg = document.getElementById('modal-image');
    const captionText = document.querySelector('.certificate-modal-caption');
    const closeBtn = document.querySelector('.certificate-modal-close');

    // Add click handlers to all certificate view buttons
    document.querySelectorAll('.view-certificate-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Only show modal for images (not PDFs)
            if (href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                e.preventDefault();
                modal.style.display = 'flex';
                modalImg.src = href;
                
                // Get certificate name from the card
                const card = this.closest('.certificate-card');
                const certName = card.querySelector('.certificate-name').textContent;
                captionText.textContent = certName;
                
                // Prevent body scroll when modal is open
                document.body.style.overflow = 'hidden';
            }
            // For PDFs, let the link open normally in a new tab
        });
    });

    // Close modal when clicking the X button
    closeBtn.addEventListener('click', closeModal);

    // Close modal when clicking outside the image
    modal.addEventListener('click', function(e) {
        if (e.target === modal || e.target === closeBtn) {
            closeModal();
        }
    });

    // Close modal when pressing ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});
