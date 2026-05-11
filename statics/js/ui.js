// statics/js/ui.js

const stepEls = document.querySelectorAll('.step');
const c1 = document.getElementById('c1');
const c2 = document.getElementById('c2');
const bcStep = document.getElementById('bc-step');
const bcTitle = document.getElementById('bc-title');

const stepsData = [
  { label: 'Upload', title: 'Upload File' },
  { label: 'Profile', title: 'Data Profile' },
  { label: 'Clean', title: 'Data Cleaning' }
];

function setStep(active) {
    stepEls.forEach((el, i) => {
        el.className = 'step';
        const circle = el.querySelector('.step-circle');
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

    c1.className = 'step-connector' + (active > 0 ? ' filled' : '');
    c2.className = 'step-connector' + (active > 1 ? ' filled' : '');
    bcStep.textContent = active + 1;
    bcTitle.textContent = stepsData[active].title;

    // Switch views
    const views = [
        document.getElementById('view-upload'),
        document.getElementById('view-profile'),
        document.getElementById('view-clean')
    ];
    views.forEach((v, i) => {
        if (v) v.className = 'view-section' + (i === active ? ' active-view' : '');
    });
}

// Make setStep globally available for display.js
window.setStep = setStep;

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