// Supabase Configuration
// Initialize Supabase with your project URL and anon key
// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://your-project.supabase.co';  // Ganti dengan URL project mu
const supabaseKey = 'your-anon-public-key';  // Ganti dengan anon key mu

const supabase = createClient(supabaseUrl, supabaseKey);

// Check auth state
let currentUser = null;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const closeLoginBtn = loginModal.querySelector('.close-btn');
const closeRegisterBtn = registerModal.querySelector('.close-btn');

// Modal toggle functions
function showLogin() {
    loginModal.style.display = 'flex';
    registerModal.style.display = 'none';
}

function showRegister() {
    registerModal.style.display = 'flex';
    loginModal.style.display = 'none';
}

// Close modals
closeLoginBtn.addEventListener('click', () => {
    loginModal.style.display = 'none';
});

closeRegisterBtn.addEventListener('click', () => {
    registerModal.style.display = 'none';
});

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target == loginModal) loginModal.style.display = 'none';
    if (e.target == registerModal) registerModal.style.display = 'none';
});

// Login Form Submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        alert('Login gagal: ' + error.message);
    } else {
        currentUser = data.user;
        loginModal.style.display = 'none';
        loadDashboard();
    }
});

// Register Form Submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    const { error, data } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (error) {
        alert('Registrasi gagal: ' + error.message);
    } else {
        // Store user profile with name
        await supabase.from('users').insert({
            id: data.user.id,
            name: name,
            email: email,
            created_at: new Date().toISOString()
        });
        alert('Registrasi berhasil! Silakan login.');
        showLogin();
    }
});

// Check current session
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        // Show user info and hide CTA, show dashboard
        document.getElementById('cta-section').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        showUserMenu();
        loadDashboard();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        document.getElementById('cta-section').style.display = 'block';
        document.getElementById('admin-dashboard').style.display = 'none';
    }
});

// User menu
function showUserMenu() {
    // This would typically show a dropdown with user name
    // For now, we'll just update the navbar
    const userName = currentUser.email.split('@')[0];
    // Could add a user-profile element to navbar
}

// Quiz Data - Operator dan Percabangan
const quizData = [
    // Operator Questions
    {
        id: 1,
        question: 'Apa hasil dari expression: 10 + 5 * 2?',
        options: ['30', '20', '22', '15'],
        correct: 2,
        explanation: 'Operator perkalian (*) memiliki prioritas lebih tinggi daripada penjumlahan (+), jadi 5 * 2 = 10, lalu 10 + 10 = 20'
    },
    {
        id: 2,
        question: 'Operator modulo (%) dalam Java menghasilkan:',
        options: ['Hasil pembagian', 'Sisa bagi', 'Sisa sisa bagi', 'Hasil kali'],
        correct: 1,
        explanation: 'Operator modulo (%) menghitung sisa bagi dari operasi pembagian'
    },
    {
        id: 3,
        question: 'Pada kode: int x = 10 / 3;, nilai x adalah:',
        options: ['3.33', '3', '3.0', '4'],
        correct: 1,
        explanation: 'Bila membagi dua bilangan int, Java akan menghasilkan hasil bertipe int (dibulatkan ke bawah)'
    },
    // Percabangan Questions
    {
        id: 4,
        question: 'Kunci seleksi yang mengevaluasi kondisi benar/salah disebut:',
        options: ['Perulangan', 'Percabangan', 'Operator', 'Fungsi'],
        correct: 1,
        explanation: 'Percabangan (selection statements) digunakan untuk mengevaluasi kondisi benar/salah'
    },
    {
        id: 5,
        question: 'Berikut ini adalah sintaks percabangan IF benar di Java adalah:',
        options: [
            'if (condition) { ... }',
            'if condition { ... }',
            'if: condition { ... }',
            'if { condition } { ... }'
        ],
        correct: 0,
        explanation: 'Sintaks if di Java memerlukan kurung kurawal setelah kondisi dalam kurung ()
    },
    {
        id: 6,
        question: 'Perintah break digunakan untuk:',
        options: ['Keluar dari loop', 'Melanjutkan ke iterasi berikutnya', 'Memulai loop baru', 'Menghentikan program'],
        correct: 0,
        explanation perintah break digunakan untuk keluar dari loop atau seleksi terdekat'
    },
    // More questions can be added...
];

// Current quiz state
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

// Render current question
function renderQuestion() {
    if (currentQuestionIndex >= quizData.length) {
        showResult();
        return;
    }
    
    const question = quizData[currentQuestionIndex];
    const container = document.getElementById('quiz-container');
    
    container.innerHTML = `
        <div class="question-card fade-in-up">
            <div class="question-number">Soal ${currentQuestionIndex + 1} dari ${quizData.length}</div>
            <h3>${question.question}</h3>
            <div class="options">
                ${question.options.map((opt, i) => `
                    <label class="option-label">
                        <input type="radio" name="answer" value="${i}" ${userAnswers[currentQuestionIndex] === i ? 'checked' : ''}>
                        <span>${String.fromCharCode(65 + i)}. ${opt}</span>
                    </label>
                `).join('')}
            </div>
            <div class="explanation" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <strong>Penjelasan:</strong> ${question.explanation}
            </div>
        </div>
    `;
}

// Show result
function showResult() {
    const percentage = (score / quizData.length * 100).toFixed(1);
    const container = document.getElementById('quiz-container');
    
    container.innerHTML = `
        <div class="result-card fade-in-up">
            <h2>Quiz Selesai!</h2>
            <div class="score-display">
                <span>${score}</span> dari ${quizData.length} soal benar
            </div>
            <div class="percentage">${percentage}%</div>
            <p>${percentage >= 80 ? 'Pernyataan indah!' : percentage >= 50 ? 'Bagus tapi bisa ditingkatkan' : 'Latih lagi!'}</p>
            <button id="restartBtn" class="btn btn-primary">Mainkan Lagi</button>
        </div>
    `;
    
    document.getElementById('restartBtn').addEventListener('click', restartQuiz);
}

// Restart quiz
function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    renderQuestion();
    setupOptionListeners();
}

// Setup option listeners
function setupOptionListeners() {
    document.querySelectorAll('input[name="answer"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            userAnswers[currentQuestionIndex] = index;
            
            // Show explanation after a brief delay
            setTimeout(() => {
                showExplanation(currentQuestionIndex);
            }, 500);
        });
    });
}

// Show explanation
function showExplanation(questionIndex) {
    const question = quizData[questionIndex];
    const explanationDiv = document.querySelector('.explanation');
    if (explanationDiv) {
        explanationDiv.style.display = 'block';
    }
    
    // Highlight correct answer
    document.querySelectorAll('input[name="answer"]').forEach((radio, i) => {
        if (i === question.correct) {
            radio.parentElement.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
        }
        if (i === userAnswers[questionIndex]) {
            radio.parentElement.style.backgroundColor = 'rgba(236, 72, 153, 0.2)';
        }
    });
}

// Next question logic
document.addEventListener('change', 'input[name="answer"]', function(e) {
    // This is handled by setupOptionListeners
});

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    if (!currentUser) {
        // Show auth modals
        loginBtn.addEventListener('click', showLogin);
        registerBtn.addEventListener('click', showRegister);
    } else {
        loadDashboard();
    }
    
    // Initialize quiz if on quiz page
    if (document.getElementById('quiz-container')) {
        renderQuestion();
        setupOptionListeners();
    }
});

// Dashboard functionality
async function loadDashboard() {
    const { data, error } = await supabase
        .from('quiz_scores')
        .select('*, users(name)')
        .order('score', { ascending: false });
    
    if (error) {
        console.error(error);
        return;
    }
    
    // Render dashboard with scores
    renderDashboard(data);
}

function renderDashboard(scores) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    
    let html = `
        <div class="dashboard-header">
            <h2>Dashboard Admin</h2>
            <p>Total Peserta: ${scores.length}</p>
        </div>
        <div class="leaderboard-table">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Nama</th>
                        <th>Skor</th>
                        <th>Persentase</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    scores.forEach((item, index) => {
        const percentage = ((item.score / quizData.length) * 100).toFixed(1);
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.users.name || 'Anonim'}</td>
                <td>${item.score}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}// Admin CRUD operations (simplified)
async function addQuestion(questionData) {
    // In a real app, this would save to Supabase
    console.log('Menambahkan soal:', questionData);
}
async function editQuestion(questionId, updatedData) {
    console.log('Mengedit soal:', questionId, updatedData);
}
async function deleteQuestion(questionId) {
    console.log('Menghapus soal:', questionId);
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// Export for use in HTML
window.addQuestion = addQuestion;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;

// Make quiz data accessible
window.quizData = quizData;

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    // Check auth state on load
    supabase.auth.getSession().then(({ data: { session } }) => {
        currentUser = session?.user;
        if (currentUser) {
            document.getElementById('cta-section').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            showQuizSection();
            loadDashboard();
        } else {
            // Show login CTAs
            document.getElementById('cta-section').style.display = 'block';
            document.getElementById('admin-dashboard').style.display = 'none';
        }
    });
});

// Show quiz section function
function showQuizSection() {
    document.getElementById('quiz-section').style.display = 'block';
    document.getElementById('cta-section').style.display = 'none';
    // Hide other sections if needed
    document.getElementById('features').style.display = 'block';
}

// Hide quiz section by default on initial load (will show when user logs in)
document.getElementById('quiz-section').style.display = 'none';

// Start quiz handler from hero section
document.getElementById('heroStartBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentUser) {
        showQuizSection();
        renderQuestion();
        setupOptionListeners();
    } else {
        showLogin();
    }
});

// Initialize login button click
loginBtn.addEventListener('click', showLogin);
registerBtn.addEventListener('click', showRegister);