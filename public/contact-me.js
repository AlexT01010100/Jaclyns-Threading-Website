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

// JavaScript for handling form submission
document.addEventListener('DOMContentLoaded', function() {
    var contactForm = document.getElementById('contactForm');

    contactForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission behavior

        var formData = new FormData(contactForm);

        // Send form data to the server
        fetch('http://localhost:63342/send_email', {  // Updated port
            method: 'POST',
            body: formData
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
