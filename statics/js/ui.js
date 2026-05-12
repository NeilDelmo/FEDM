// statics/js/ui.js

const stepsData = [
    { label: 'Upload', title: 'Preview Data' },
    { label: 'Profile', title: 'Data Profile' },
    { label: 'Clean', title: 'Data Cleaning' },
    { label: 'Analyze', title: 'Insights' },
    { label: 'Visualize', title: 'Visualization' }
];

function updateModalStepper(active) {
    const modalSteps = document.querySelectorAll('.modal-step');
    const modalC1 = document.getElementById('modal-c1');
    const modalC2 = document.getElementById('modal-c2');
    const modalC3 = document.getElementById('modal-c3');
    const modalC4 = document.getElementById('modal-c4');

    if (modalSteps.length === 0) return;

    modalSteps.forEach((el, i) => {
        el.className = 'modal-step';
        const circle = el.querySelector('.modal-step-circle');
        if (i < active) {
            el.classList.add('done');
            circle.innerHTML = '&#10003;';
        } else if (i === active) {
            el.classList.add('active');
            circle.textContent = i + 1;
        } else {
            circle.textContent = i + 1;
        }
    });

    if (modalC1) modalC1.className = 'modal-step-connector' + (active > 0 ? ' filled' : '');
    if (modalC2) modalC2.className = 'modal-step-connector' + (active > 1 ? ' filled' : '');
    if (modalC3) modalC3.className = 'modal-step-connector' + (active > 2 ? ' filled' : '');
    if (modalC4) modalC4.className = 'modal-step-connector' + (active > 3 ? ' filled' : '');
}

function switchModalContent(stepIndex) {
    const allModalContents = document.querySelectorAll('[id^="modal-content-"]');
    allModalContents.forEach(el => {
        el.classList.remove('active-modal-content');
    });

    const activeContent = document.getElementById(`modal-content-${stepIndex}`);
    if (activeContent) {
        activeContent.classList.add('active-modal-content');
    }

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle && stepsData[stepIndex]) {
        modalTitle.textContent = stepsData[stepIndex].title;
    }
}

function resetPageViews() {
    const views = [
        document.getElementById('view-upload'),
        document.getElementById('view-profile'),
        document.getElementById('view-clean')
    ];
    views.forEach((v) => {
        if (!v) return;
        v.className = v.id === 'view-upload' ? 'view-section active-view' : 'view-section';
    });
}

function setStep(active) {
    updateModalStepper(active);

    const modal = document.getElementById('data-modal');
    if (modal && modal.style.display === 'flex') {
        switchModalContent(active);
    }

    resetPageViews();
}

window.setStep = setStep;

document.addEventListener('DOMContentLoaded', function () {
    const modalSteps = document.querySelectorAll('.modal-step');
    modalSteps.forEach((step, i) => {
        step.addEventListener('click', function () {
            setStep(i);

            // Load Insights lazily when user clicks Step 4 (Analyze)
            if (i === 3 && window.currentData) {
                if (typeof displayInsights === 'function') {
                    displayInsights(window.currentData);
                }
            }

            // Load Charts lazily when user clicks Step 5 (Visualize)
            if (i === 4 && window.currentData) {
                if (typeof displayCharts === 'function') {
                    displayCharts(window.currentData);
                }
            }
        });
    });
});

// Clerk auth
window.addEventListener("load", async function () {
    try {
        await Clerk.load({
            ui: { ClerkUI: window.__internal_ClerkUICtor },
        });

        if (!Clerk.user) {
            window.location.replace("/");
            return;
        }

        Clerk.mountUserButton(document.getElementById("user-button"), {
            afterSignOutUrl: "/",
        });
    } catch (err) {
        console.error("Clerk Error:", err);
    }
});