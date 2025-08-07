// Shared types index - exports all type definitions
export * from './patient';

// Re-export commonly used types for convenience
export type {
    IPatient,
    PatientNote,
    IPatientDocument,
    CreatePatientRequest,
    UpdatePatientRequest,
    PatientResponse,
    PatientStats,
    PatientSearchParams,
    PatientSearchResponse
} from './patient';

export {
    PATIENT_VALIDATION,
    GENDER_LABELS,
    COMMON_VACCINATIONS
} from './patient';