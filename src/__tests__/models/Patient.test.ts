import { Patient, IPatientDocument } from '../../models/Patient';
import { connectDB, closeDB, clearDB } from '../testUtils';

describe('Patient Model', () => {
    beforeAll(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        await clearDB();
    });

    afterAll(async () => {
        await closeDB();
    });

    describe('Patient Creation', () => {
        it('should create a valid patient', async () => {
            const patientData = {
                firstName: 'Juan',
                lastName: 'Pérez',
                address: 'Zona 1, Guatemala City',
                age: 35,
                gender: 'male' as const,
                maritalStatus: 'Casado',
                occupation: 'Ingeniero',
                phone: '+502 1234-5678',
                vaccination: ['COVID-19', 'Influenza'],
                visitDate: new Date(),
                notes: []
            };

            const patient = new Patient(patientData);
            const savedPatient = await patient.save();

            expect(savedPatient._id).toBeDefined();
            expect(savedPatient.firstName).toBe('Juan');
            expect(savedPatient.lastName).toBe('PéRez');
            expect(savedPatient.phone).toBe('+502 1234-5678');
            expect(savedPatient.createdAt).toBeDefined();
            expect(savedPatient.updatedAt).toBeDefined();
        });

        it('should auto-capitalize names', async () => {
            const patientData = {
                firstName: 'maría josé',
                lastName: 'garcía lópez',
                address: 'Zona 10, Guatemala',
                age: 28,
                gender: 'female' as const,
                maritalStatus: 'Soltera',
                occupation: 'Doctora',
                phone: '+502 9876-5432',
                visitDate: new Date()
            };

            const patient = new Patient(patientData);
            const savedPatient = await patient.save();

            expect(savedPatient.firstName).toBe('MaríA José');
            expect(savedPatient.lastName).toBe('GarcíA LóPez');
        });

        it('should require all mandatory fields', async () => {
            const patient = new Patient({});

            await expect(patient.save()).rejects.toThrow();
        });

        it('should validate phone number format', async () => {
            const patientData = {
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
                age: 25,
                gender: 'male' as const,
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: 'invalid-phone',
                visitDate: new Date()
            };

            const patient = new Patient(patientData);
            await expect(patient.save()).rejects.toThrow(/Phone number format is invalid/);
        });

        it('should validate age range', async () => {
            const patientData = {
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address that is long enough',
                age: 151, // Invalid age (exceeds max of 150)
                gender: 'male' as const,
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 1234-5678',
                visitDate: new Date()
            };

            const patient = new Patient(patientData);
            await expect(patient.save()).rejects.toThrow(/Age cannot exceed/);
        });

        it('should validate gender enum', async () => {
            const patientData = {
                firstName: 'Test',
                lastName: 'User',
                address: 'Test Address',
                age: 25,
                gender: 'invalid' as 'male' | 'female' | 'child',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 1234-5678',
                visitDate: new Date()
            };

            const patient = new Patient(patientData);
            await expect(patient.save()).rejects.toThrow(/Gender must be one of/);
        });
    });

    describe('Patient Methods', () => {
        let patient: IPatientDocument;

        beforeEach(async () => {
            patient = new Patient({
                firstName: 'Ana',
                lastName: 'Martínez',
                address: 'Zona 4, Guatemala',
                age: 30,
                gender: 'female',
                maritalStatus: 'Casada',
                occupation: 'Enfermera',
                phone: '+502 5555-1234',
                visitDate: new Date(),
                notes: []
            });
            await patient.save();
        });

        it('should add a note to patient', async () => {
            await patient.addNote('Consulta General', 'Paciente presenta síntomas leves');

            expect(patient.notes).toHaveLength(1);
            expect(patient.notes[0].title).toBe('Consulta General');
            expect(patient.notes[0].content).toBe('Paciente presenta síntomas leves');
            expect(patient.notes[0].date).toBeDefined();
        });

        it('should get recent notes', async () => {
            // Add multiple notes
            await patient.addNote('Nota 1', 'Contenido 1');
            await patient.addNote('Nota 2', 'Contenido 2');
            await patient.addNote('Nota 3', 'Contenido 3');

            const recentNotes = patient.getRecentNotes(2);
            expect(recentNotes).toHaveLength(2);
            expect(recentNotes[0].title).toBe('Nota 3'); // Most recent first
        });

        it('should have fullName virtual property', () => {
            expect(patient.fullName).toBe('Ana MartíNez');
        });
    });

    describe('Patient Static Methods', () => {
        beforeEach(async () => {
            // Create test patients
            await Patient.create([
                {
                    firstName: 'Carlos',
                    lastName: 'Rodríguez',
                    address: 'Zona 7, Guatemala',
                    age: 45,
                    gender: 'male',
                    maritalStatus: 'Casado',
                    occupation: 'Contador',
                    phone: '+502 1111-2222',
                    visitDate: new Date()
                },
                {
                    firstName: 'Laura',
                    lastName: 'González',
                    address: 'Zona 15, Guatemala',
                    age: 32,
                    gender: 'female',
                    maritalStatus: 'Soltera',
                    occupation: 'Abogada',
                    phone: '+502 3333-4444',
                    visitDate: new Date()
                },
                {
                    firstName: 'Pedro',
                    lastName: 'López',
                    address: 'Zona 12, Guatemala',
                    age: 8,
                    gender: 'child',
                    maritalStatus: 'Soltero',
                    occupation: 'Estudiante',
                    phone: '+502 5555-6666',
                    visitDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days ago
                }
            ]);
        });

        it('should find patient by phone', async () => {
            const patient = await Patient.findByPhone('+502 1111-2222');
            expect(patient).toBeTruthy();
            expect(patient?.firstName).toBe('Carlos');
        });

        it('should find patients by name', async () => {
            const patients = await Patient.findByName('Laura', 'González');
            expect(patients).toHaveLength(1);
            expect(patients[0].firstName).toBe('Laura');
        });

        it('should get patient statistics', async () => {
            const stats = await Patient.getStats();

            expect(stats.total).toBe(3);
            expect(stats.male).toBe(1);
            expect(stats.female).toBe(1);
            expect(stats.children).toBe(1);
            expect(stats.averageAge).toBeGreaterThan(0);
            expect(stats.recentVisits).toBe(2); // Only 2 recent visits (within 30 days)
        });
    });

    describe('Patient Validation', () => {
        it('should enforce unique phone numbers', async () => {
            const phone = '+502 7777-8888';

            await Patient.create({
                firstName: 'First',
                lastName: 'Patient',
                address: 'Zona 1, Guatemala City, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Job 1',
                phone,
                visitDate: new Date()
            });

            // Try to create another patient with same phone
            const duplicatePatient = new Patient({
                firstName: 'Second',
                lastName: 'Patient',
                address: 'Zona 2, Guatemala City, Guatemala',
                age: 30,
                gender: 'female',
                maritalStatus: 'Single',
                occupation: 'Job 2',
                phone,
                visitDate: new Date()
            });

            await expect(duplicatePatient.save()).rejects.toThrow();
        });

        it('should limit number of notes', async () => {
            const patient = new Patient({
                firstName: 'Test',
                lastName: 'Patient',
                address: 'Test Address',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 9999-0000',
                visitDate: new Date(),
                notes: Array(51).fill(0).map((_, i) => ({
                    title: `Note ${i}`,
                    content: `Content ${i}`,
                    date: new Date()
                }))
            });

            await expect(patient.save()).rejects.toThrow(/Cannot have more than 50 notes/);
        });

        it('should validate vaccination array', async () => {
            const patient = new Patient({
                firstName: 'Test',
                lastName: 'Patient',
                address: 'Test Address',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 8888-9999',
                visitDate: new Date(),
                vaccination: ['Valid', '', 'Another Valid'] // Empty string should fail
            });

            await expect(patient.save()).rejects.toThrow(/All vaccinations must be non-empty strings/);
        });
    });

    describe('Patient JSON Transformation', () => {
        it('should transform _id to id in JSON', async () => {
            const patient = await Patient.create({
                firstName: 'JSON',
                lastName: 'Test',
                address: 'Test Address',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 0000-1111',
                visitDate: new Date()
            });

            const json = patient.toJSON();
            expect(json.id).toBeDefined();
            expect(json._id).toBeUndefined();
            expect(json.__v).toBeUndefined();
        });
    });
});