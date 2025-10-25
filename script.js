// ApeXNOS Website Interactive Effects
document.addEventListener('DOMContentLoaded', function() {
    
    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    hamburger.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });
    
    // Touch-friendly mobile menu improvements
    if ('ontouchstart' in window) {
        // Add touch feedback to navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            
            link.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            });
        });
        
        // Improve touch targets for player cards
        document.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            
            card.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            });
        });
    }
    
    // Smooth scrolling for navigation links
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
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 10, 0.98)';
            navbar.style.boxShadow = '0 2px 20px rgba(0, 212, 255, 0.3)';
        } else {
            navbar.style.background = 'rgba(10, 10, 10, 0.95)';
            navbar.style.boxShadow = 'none';
        }
    });
    
    // Animated counter for statistics
    function animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        const speed = 200; // The lower the slower
        
        counters.forEach(counter => {
            const updateCount = () => {
                const target = +counter.getAttribute('data-target');
                const count = +counter.innerText;
                
                // Lower increment for slower counting
                const inc = target / speed;
                
                // Check if target is reached
                if (count < target) {
                    // Add inc to count and output in counter
                    counter.innerText = Math.ceil(count + inc);
                    // Call function every ms
                    setTimeout(updateCount, 1);
                } else {
                    counter.innerText = target;
                }
            };
            
            updateCount();
        });
    }
    
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Trigger counter animation when stats section is visible
                if (entry.target.classList.contains('stats-grid')) {
                    animateCounters();
                }
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.stat-item, .player-card, .tournament-item, .tech-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });
    
    // Matrix rain effect
    function createMatrixRain() {
        const matrixContainer = document.getElementById('matrix-rain');
        const characters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
        const fontSize = 14;
        const columns = Math.floor(window.innerWidth / fontSize);
        
        // Clear existing matrix
        matrixContainer.innerHTML = '';
        
        for (let i = 0; i < columns; i++) {
            const column = document.createElement('div');
            column.style.position = 'absolute';
            column.style.top = '-100px';
            column.style.left = i * fontSize + 'px';
            column.style.fontSize = fontSize + 'px';
            column.style.fontFamily = 'monospace';
            column.style.color = Math.random() > 0.5 ? '#00d4ff' : '#ff6b35';
            column.style.opacity = '0.8';
            column.style.textShadow = '0 0 5px currentColor';
            column.style.zIndex = '-10';
            column.style.pointerEvents = 'none';
            column.style.animation = `matrixFall ${Math.random() * 3 + 2}s linear infinite`;
            column.style.animationDelay = Math.random() * 2 + 's';
            
            let text = '';
            for (let j = 0; j < 20; j++) {
                text += characters[Math.floor(Math.random() * characters.length)] + '<br>';
            }
            column.innerHTML = text;
            
            matrixContainer.appendChild(column);
        }
    }
    
    // Add matrix fall animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes matrixFall {
            0% {
                transform: translateY(-100vh);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh);
                opacity: 0;
            }
        }
        
        .animate-in {
            animation: slideInUp 0.6s ease-out forwards;
        }
        
        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .player-card.animate-in {
            animation: slideInUp 0.6s ease-out forwards;
        }
        
        .stat-item.animate-in {
            animation: slideInUp 0.6s ease-out forwards;
        }
        
        .tournament-item.animate-in {
            animation: slideInUp 0.6s ease-out forwards;
        }
        
        .tech-item.animate-in {
            animation: slideInUp 0.6s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize matrix rain
    createMatrixRain();
    
    // Recreate matrix rain on window resize
    window.addEventListener('resize', function() {
        clearTimeout(window.matrixTimeout);
        window.matrixTimeout = setTimeout(createMatrixRain, 250);
    });
    
    // Glitch effect for logo
    function addGlitchEffect() {
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.addEventListener('mouseenter', function() {
                this.style.animation = 'glitch 0.3s ease-in-out';
            });
            
            logo.addEventListener('animationend', function() {
                this.style.animation = '';
            });
        }
    }
    
    addGlitchEffect();
    
    // Particle system for hero section
    function createParticles() {
        const hero = document.querySelector('.hero');
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = '2px';
            particle.style.height = '2px';
            particle.style.background = Math.random() > 0.5 ? '#00d4ff' : '#ff6b35';
            particle.style.borderRadius = '50%';
            particle.style.boxShadow = '0 0 6px currentColor';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animation = `particleFloat ${Math.random() * 10 + 5}s linear infinite`;
            particle.style.animationDelay = Math.random() * 5 + 's';
            
            hero.appendChild(particle);
        }
        
        // Add particle animation
        const particleStyle = document.createElement('style');
        particleStyle.textContent = `
            @keyframes particleFloat {
                0% {
                    transform: translateY(100vh) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(-100vh) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(particleStyle);
    }
    
    createParticles();
    
    // Typing effect for hero subtitle
    function typeWriter(element, text, speed = 100) {
        let i = 0;
        element.innerHTML = '';
        
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        
        type();
    }
    
    // Initialize typing effect
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) {
        const originalText = heroSubtitle.textContent;
        setTimeout(() => {
            typeWriter(heroSubtitle, originalText, 150);
        }, 1000);
    }
    
    // Form submission handling
    const recruitmentForm = document.querySelector('.recruitment-form');
    if (recruitmentForm) {
        recruitmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            // Simulate form submission
            const submitBtn = this.querySelector('.btn-submit');
            const originalText = submitBtn.textContent;
            
            submitBtn.textContent = 'SUBMITTING...';
            submitBtn.disabled = true;
            
            setTimeout(() => {
                submitBtn.textContent = 'APPLICATION SENT!';
                submitBtn.style.background = 'linear-gradient(45deg, #00ff41, #00cc33)';
                
                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    submitBtn.style.background = 'linear-gradient(45deg, #00d4ff, #ff6b35)';
                    this.reset();
                }, 3000);
            }, 2000);
        });
    }
    
    // Hologram interaction
    function addHologramInteraction() {
        const hologram = document.querySelector('.hologram-logo');
        if (hologram) {
            hologram.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1) rotate(10deg)';
                this.style.boxShadow = '0 0 50px #00d4ff, inset 0 0 50px rgba(0, 212, 255, 0.3)';
            });
            
            hologram.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1) rotate(0deg)';
                this.style.boxShadow = '0 0 30px #00d4ff, inset 0 0 30px rgba(0, 212, 255, 0.2)';
            });
        }
    }
    
    addHologramInteraction();
    
    // Scroll progress indicator
    function createScrollProgress() {
        const progressBar = document.createElement('div');
        progressBar.style.position = 'fixed';
        progressBar.style.top = '0';
        progressBar.style.left = '0';
        progressBar.style.width = '0%';
        progressBar.style.height = '3px';
        progressBar.style.background = 'linear-gradient(90deg, #00d4ff, #ff6b35)';
        progressBar.style.zIndex = '9999';
        progressBar.style.transition = 'width 0.1s ease';
        
        document.body.appendChild(progressBar);
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset;
            const docHeight = document.body.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            progressBar.style.width = scrollPercent + '%';
        });
    }
    
    createScrollProgress();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // ESC to close mobile menu
        if (e.key === 'Escape') {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }
        
        // Space to pause/resume animations
        if (e.key === ' ' && e.target === document.body) {
            e.preventDefault();
            document.body.classList.toggle('paused');
        }
    });
    
    // Add pause styles
    const pauseStyle = document.createElement('style');
    pauseStyle.textContent = `
        .paused * {
            animation-play-state: paused !important;
        }
    `;
    document.head.appendChild(pauseStyle);
    
    // Performance optimization: Reduce animations on low-end devices
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        document.body.classList.add('reduced-motion');
        const reducedMotionStyle = document.createElement('style');
        reducedMotionStyle.textContent = `
            .reduced-motion * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(reducedMotionStyle);
    }
    
    // Mobile-specific optimizations
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Reduce matrix rain intensity on mobile
        const matrixContainer = document.getElementById('matrix-rain');
        if (matrixContainer) {
            matrixContainer.style.opacity = '0.05';
        }
        
        // Disable some heavy animations on mobile
        const style = document.createElement('style');
        style.textContent = `
            .mobile-optimized .hologram-img {
                animation: none !important;
            }
            .mobile-optimized .scan-lines {
                animation: none !important;
            }
            .mobile-optimized .tech-item {
                animation: none !important;
            }
        `;
        document.head.appendChild(style);
        document.body.classList.add('mobile-optimized');
    }
    
    // Console easter egg
    console.log(`
    ╔══════════════════════════════════════╗
    ║           APEXNOS CLAN               ║
    ║                                      ║
    ║  Welcome to the elite gaming realm!  ║
    ║                                      ║
    ║  Type 'apexnos.recruit()' to join    ║
    ║                                      ║
    ╚══════════════════════════════════════╝
    `);
    
    // Add recruitment function to window
    window.apexnos = {
        recruit: function() {
            alert('Welcome to ApeXNOS! Check out our Discord for recruitment details.');
            document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    console.log('ApeXNOS website loaded successfully! 🎮');
});
