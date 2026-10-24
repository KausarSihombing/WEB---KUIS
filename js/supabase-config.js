// Supabase Configuration
// Initialize Supabase client
const supabaseUrl = 'https://your-project.supabase.co'; // Ganti dengan URL project mu
const supabaseAnonKey = 'your-anon-key'; // Ganti dengan anon key mu

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Schema Constants
export const SCHEMA = {
    TABLES: {
        USERS: 'users',
        QUESTIONS: 'questions'
    },
    COLUMNS: {
        USERS: {
            ID: 'id',
            EMAIL: 'email',
            PASSWORD: 'password',
            ROLE: 'role'
        },
        QUESTIONS: {
            ID: 'id',
            TIPE_SOAL: 'tipe_soal',
            PERTANYAAN: 'pertanyaan',
            OPTION_A: 'opsi_a',
            OPTION_B: 'opsi_b',
            OPTION_C: 'opsi_c',
            OPTION_D: 'opsi_d',
            JAWABAN_BENAR: 'jawaban_benar'
        }
    },
    TIPE_SOAL: {
        PILIHAN_GANDA: 'pilihan_ganda',
        ESSAY: 'esai'
    }
};

// Helper function to validate row structure
export function validateUserRow(row) {
    return row && 
           row[SCHEMA.COLUMNS.USERS.ID] && 
           row[SCHEMA.COLUMNS.USERS.EMAIL] && 
           row[SCHEMA.COLUMNS.USERS.ROLE];
}

export function validateQuestionRow(row) {
    return row && 
           row[SCHEMA.COLUMNS.QUESTIONS.ID] && 
           row[SCHEMA.COLUMNS.QUESTIONS.TIPE_SOAL] && 
           row[SCHEMA.COLUMNS.QUESTIONS.PERTANYAAN];
}

// Initialize database tables (to be run once via Supabase SQL editor)
export const INITIAL_SQL = `
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT uuid_gener() PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
    );

    -- Create questions table
    CREATE TABLE IF NOT EXISTS questions (
        id UUID DEFAULT uuid_gener() PRIMARY KEY,
        tipe_soal TEXT NOT NULL CHECK (tipe_soal IN ('pilihan_ganda', 'esai')),
        pertanyaan TEXT NOT NULL,
        opsi_a TEXT,
        opsi_b TEXT,
        opsi_c TEXT,
        opsi_d TEXT,
        jawaban_benar TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
    );
`;