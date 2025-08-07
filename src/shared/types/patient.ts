// Shared TypeScript interfaces for Patient entity
// Used by both frontend (ui) and backend (server)

export interface PatientNote {
    id?: string;
    title: string;
    content: string;
    date: Date | string;
}

export interface IPatient {
    id?: string;
    firstName: string;
    lastName: string;
    address?: string;
    birthdate?: Date | string;
    gender?: 'male' | 'female' | 'child';
    maritalStatus?: string;
    occupation?: string;
    phone?: string;
    vaccination?: string[];
    visitDate?: Date | string;
    notes?: PatientNote[];
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

// For MongoDB Document (extends Mongoose Document)
export interface IPatientDocument extends IPatient {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
}

// For API requests/responses
export interface CreatePatientRequest {
    firstName: string;
    lastName: string;
    address?: string;
    birthdate?: string; // ISO date string
    gender?: 'male' | 'female' | 'child';
    maritalStatus?: string;
    occupation?: string;
    phone?: string;
    vaccination?: string[];
    visitDate?: string; // ISO date string
    notes?: Omit<PatientNote, 'id' | 'date'>[];
}

export interface UpdatePatientRequest extends Partial<CreatePatientRequest> {
    id: string;
}

export interface PatientResponse extends IPatient {
    id: string;
    createdAt: string;
    updatedAt: string;
}

// For statistics
export interface PatientStats {
    total: number;
    male: number;
    female: number;
    children: number;
    averageAge: number;
    recentVisits: number; // visits in last 30 days
}

// For search and filtering
export interface PatientSearchParams {
    query?: string;
    gender?: 'male' | 'female' | 'child';
    ageMin?: number;
    ageMax?: number;
    visitDateFrom?: string;
    visitDateTo?: string;
    limit?: number;
    offset?: number;
}

export interface PatientSearchResponse {
    patients: PatientResponse[];
    total: number;
    limit: number;
    offset: number;
}

// Validation schemas (for both frontend and backend)
export const PATIENT_VALIDATION = {
    firstName: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/
    },
    lastName: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/
    },
    birthdate: {
        required: false,
        minAge: new Date(new Date().getFullYear() - 150, 0, 1), // 150 years ago
        maxAge: new Date() // Today
    },
    phone: {
        required: false,
        pattern: /^[\d\-\+\(\)\s]+$/,
        minLength: 8,
        maxLength: 20
    },
    address: {
        required: false,
        minLength: 10,
        maxLength: 200
    }
} as const;

// Gender labels for UI
export const GENDER_LABELS = {
    male: 'Masculino',
    female: 'Femenino',
    child: 'Niño/a'
} as const;

// Common vaccination options for Guatemala
export const COMMON_VACCINATIONS = [
    'COVID-19',
    'Influenza',
    'Hepatitis A',
    'Hepatitis B',
    'MMR (Sarampión, Paperas, Rubéola)',
    'DPT (Difteria, Pertussis, Tétanos)',
    'Polio',
    'BCG (Tuberculosis)',
    'Varicela',
    'Neumococo',
    'Rotavirus',
    'HPV (Virus del Papiloma Humano)'
] as const;