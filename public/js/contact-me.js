// JavaScript for toggling the navbar menu
function toggleMenu() {
    var navbarMenu = document.getElementById("navbarMenu");
    navbarMenu.classList.toggle("active");
}

// Close the menu if clicking outside of it
document.addEventListener('click', function(event) {
    var navbarMenu = document.getElementById("navbarMenu");
    var icon = document.querySelector('.navbar .icon');
    if (!navbarMenu.contains(event.target) && event.target !== icon) {
        navbarMenu.classList.remove('active');
    }
});

//form handling
document.addEventListener('DOMContentLoaded', function() {
    var contactForm = document.getElementById('contactForm');
    
    // Check if the contact form exists on this page
    if (!contactForm) {
        return; // Exit if not on contact page
    }

    contactForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission behavior

        var formData = new FormData(contactForm);

        // Convert FormData to URLSearchParams to mimic form submission
        var urlEncodedData = new URLSearchParams(formData).toString();

        // Send form data to the server
        fetch('/send_email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: urlEncodedData
        })
            .then(response => response.text())
            .then(result => {
                // Show a success message or update the UI as needed
                alert('Email sent successfully.');
                contactForm.reset(); // Optional: Reset the form after successful submission
            })
            .catch(error => {
                // Show an error message or update the UI as needed
                console.error('Error:', error);
                alert('Failed to send email.');
            });
    });
});
