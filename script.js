document.addEventListener("DOMContentLoaded", function() {
    console.log('DOMContentLoaded event fired.');

    const sliderWrapper = document.querySelector('.slider-wrapper');
    const slider = document.querySelector('.slider');
    const images = document.querySelectorAll('.slider img');
    let currentIndex = 0;
    const totalImages = images.length;
    let imageWidth = images[0].offsetWidth;

    function scrollToNextImage() {
        console.log('scrollToNextImage called.');
        if (currentIndex < totalImages - 1) {
            ++currentIndex;
        } else {
            currentIndex = 0;
        }
        const newPosition = currentIndex * imageWidth;
        console.log('New position:', newPosition);
        slider.scroll({
            left: newPosition,
            behavior: 'smooth'
        });
    }


    function updateImageWidth() {
        imageWidth = images[0].offsetWidth; // Recalculate image width on resize
    }

    window.addEventListener('resize', updateImageWidth);

    let intervalId = setInterval(scrollToNextImage, 3000); // Change image every 3 seconds (adjust as needed)
    console.log('Interval set:', intervalId);

    sliderWrapper.addEventListener('mouseenter', () => {
        clearInterval(intervalId); // Pause slider on hover
        console.log('Slider paused.');
    });

    sliderWrapper.addEventListener('mouseleave', () => {
        intervalId = setInterval(scrollToNextImage, 5000); // Resume slider on mouse leave
        console.log('Slider resumed.');
    });

});
