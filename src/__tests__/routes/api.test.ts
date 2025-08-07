import { FastifyInstance } from 'fastify';
import { build } from '../testApp';
import { connectDB, closeDB, clearDB } from '../testUtils';
import { Patient } from '../../models/Patient';

describe('API Routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        await connectDB();
        app = await build();
    });

    beforeEach(async () => {
        await clearDB();
    });

    afterAll(async () => {
        await app.close();
        await closeDB();
    });

    describe('GET /api/stats', () => {
        it('should return empty stats when no patients exist', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/stats'
            });

            expect(response.statusCode).toBe(200);
            const stats = JSON.parse(response.payload);
            expect(stats).toEqual({
                total: 0,
                male: 0,
                female: 0,
                children: 0,
                averageAge: 0,
                recentVisits: 0
            });
        });

        it('should return correct stats with patients', async () => {
            // Create test patients
            await Patient.create([
                {
                    firstName: 'Juan',
                    lastName: 'Pérez',
                    address: 'Zona 1, Guatemala City',
                    age: 35,
                    gender: 'male',
                    maritalStatus: 'Casado',
                    occupation: 'Ingeniero',
                    phone: '+502 1111-1111',
                    visitDate: new Date()
                },
                {
                    firstName: 'María',
                    lastName: 'González',
                    address: 'Zona 10, Guatemala City',
                    age: 28,
                    gender: 'female',
                    maritalStatus: 'Soltera',
                    occupation: 'Doctora',
                    phone: '+502 2222-2222',
                    visitDate: new Date()
                },
                {
                    firstName: 'Pedro',
                    lastName: 'López',
                    address: 'Zona 12, Guatemala City',
                    age: 8,
                    gender: 'child',
                    maritalStatus: 'Soltero',
                    occupation: 'Estudiante',
                    phone: '+502 3333-3333',
                    visitDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days ago
                }
            ]);

            const response = await app.inject({
                method: 'GET',
                url: '/api/stats'
            });

            expect(response.statusCode).toBe(200);
            const stats = JSON.parse(response.payload);
            expect(stats.total).toBe(3);
            expect(stats.male).toBe(1);
            expect(stats.female).toBe(1);
            expect(stats.children).toBe(1);
            expect(stats.averageAge).toBe(24); // (35 + 28 + 8) / 3 = 23.67 rounded to 24
            expect(stats.recentVisits).toBe(2); // Only 2 recent visits (within 30 days)
        });
    });

    describe('GET /api/patients', () => {
        beforeEach(async () => {
            // Create test patients
            await Patient.create([
                {
                    firstName: 'Ana',
                    lastName: 'Martínez',
                    address: 'Zona 4, Guatemala City',
                    age: 30,
                    gender: 'female',
                    maritalStatus: 'Casada',
                    occupation: 'Enfermera',
                    phone: '+502 4444-4444',
                    visitDate: new Date()
                },
                {
                    firstName: 'Carlos',
                    lastName: 'Rodríguez',
                    address: 'Zona 7, Guatemala City',
                    age: 45,
                    gender: 'male',
                    maritalStatus: 'Casado',
                    occupation: 'Contador',
                    phone: '+502 5555-5555',
                    visitDate: new Date()
                }
            ]);
        });

        it('should return all patients', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.payload);
            expect(data.patients).toHaveLength(2);
            expect(data.total).toBe(2);
            expect(data.limit).toBe(10);
            expect(data.offset).toBe(0);
        });

        it('should filter by gender', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients?gender=female'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.payload);
            expect(data.patients).toHaveLength(1);
            expect(data.patients[0].gender).toBe('female');
        });

        it('should filter by age range', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients?ageMin=40&ageMax=50'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.payload);
            expect(data.patients).toHaveLength(1);
            expect(data.patients[0].age).toBe(45);
        });

        it('should support pagination', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients?limit=1&offset=1'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.payload);
            expect(data.patients).toHaveLength(1);
            expect(data.limit).toBe(1);
            expect(data.offset).toBe(1);
        });
    });

    describe('GET /api/patients/:id', () => {
        let patientId: string;

        beforeEach(async () => {
            const patient = await Patient.create({
                firstName: 'Test',
                lastName: 'Patient',
                address: 'Test Address, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 6666-6666',
                visitDate: new Date()
            });
            patientId = patient._id.toString();
        });

        it('should return patient by id', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/api/patients/${patientId}`
            });

            expect(response.statusCode).toBe(200);
            const patient = JSON.parse(response.payload);
            expect(patient.id).toBe(patientId);
            expect(patient.firstName).toBe('Test');
        });

        it('should return 404 for non-existent patient', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients/507f1f77bcf86cd799439011'
            });

            expect(response.statusCode).toBe(404);
            const error = JSON.parse(response.payload);
            expect(error.error).toBe('Not Found');
        });
    });

    describe('POST /api/patients', () => {
        const validPatientData = {
            firstName: 'New',
            lastName: 'Patient',
            address: 'New Address, Guatemala City',
            age: 30,
            gender: 'female',
            maritalStatus: 'Soltera',
            occupation: 'Doctora',
            phone: '+502 7777-7777',
            visitDate: new Date().toISOString(),
            vaccination: ['COVID-19'],
            notes: []
        };

        it('should create a new patient', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/patients',
                payload: validPatientData
            });

            expect(response.statusCode).toBe(201);
            const patient = JSON.parse(response.payload);
            expect(patient.firstName).toBe('New');
            expect(patient.lastName).toBe('Patient');
            expect(patient.id).toBeDefined();
        });

        it('should return validation error for invalid data', async () => {
            const invalidData = {
                ...validPatientData,
                age: 200 // Invalid age
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/patients',
                payload: invalidData
            });

            expect(response.statusCode).toBe(400);
            const error = JSON.parse(response.payload);
            expect(error.error).toBe('Validation Error');
        });

        it('should return validation error for missing required fields', async () => {
            const incompleteData = {
                firstName: 'Test'
                // Missing required fields
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/patients',
                payload: incompleteData
            });

            expect(response.statusCode).toBe(400);
            const error = JSON.parse(response.payload);
            expect(error.error).toBe('Validation Error');
        });
    });

    describe('PUT /api/patients/:id', () => {
        let patientId: string;

        beforeEach(async () => {
            const patient = await Patient.create({
                firstName: 'Update',
                lastName: 'Test',
                address: 'Original Address, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 8888-8888',
                visitDate: new Date()
            });
            patientId = patient._id.toString();
        });

        it('should update patient', async () => {
            const updateData = {
                firstName: 'Updated',
                age: 26
            };

            const response = await app.inject({
                method: 'PUT',
                url: `/api/patients/${patientId}`,
                payload: updateData
            });

            expect(response.statusCode).toBe(200);
            const patient = JSON.parse(response.payload);
            expect(patient.firstName).toBe('Updated');
            expect(patient.age).toBe(26);
        });

        it('should return 404 for non-existent patient', async () => {
            const response = await app.inject({
                method: 'PUT',
                url: '/api/patients/507f1f77bcf86cd799439011',
                payload: { firstName: 'Test' }
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('DELETE /api/patients/:id', () => {
        let patientId: string;

        beforeEach(async () => {
            const patient = await Patient.create({
                firstName: 'Delete',
                lastName: 'Test',
                address: 'Delete Address, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 9999-9999',
                visitDate: new Date()
            });
            patientId = patient._id.toString();
        });

        it('should delete patient', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: `/api/patients/${patientId}`
            });

            expect(response.statusCode).toBe(200);
            const result = JSON.parse(response.payload);
            expect(result.message).toBe('Patient deleted successfully');

            // Verify patient is deleted
            const patient = await Patient.findById(patientId);
            expect(patient).toBeNull();
        });

        it('should return 404 for non-existent patient', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/patients/507f1f77bcf86cd799439011'
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /api/patients/:id/notes', () => {
        let patientId: string;

        beforeEach(async () => {
            const patient = await Patient.create({
                firstName: 'Note',
                lastName: 'Test',
                address: 'Note Address, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 0000-0000',
                visitDate: new Date()
            });
            patientId = patient._id.toString();
        });

        it('should add note to patient', async () => {
            const noteData = {
                title: 'Test Note',
                content: 'This is a test note content'
            };

            const response = await app.inject({
                method: 'POST',
                url: `/api/patients/${patientId}/notes`,
                payload: noteData
            });

            expect(response.statusCode).toBe(200);
            const patient = JSON.parse(response.payload);
            expect(patient.notes).toHaveLength(1);
            expect(patient.notes[0].title).toBe('Test Note');
        });

        it('should return validation error for missing title or content', async () => {
            const response = await app.inject({
                method: 'POST',
                url: `/api/patients/${patientId}/notes`,
                payload: { title: 'Test' } // Missing content
            });

            expect(response.statusCode).toBe(400);
            const error = JSON.parse(response.payload);
            expect(error.error).toBe('Validation Error');
        });

        it('should return 404 for non-existent patient', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/patients/507f1f77bcf86cd799439011/notes',
                payload: { title: 'Test', content: 'Test content' }
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('GET /api/patients/search/phone/:phone', () => {
        beforeEach(async () => {
            await Patient.create({
                firstName: 'Phone',
                lastName: 'Search',
                address: 'Phone Address, Guatemala',
                age: 25,
                gender: 'male',
                maritalStatus: 'Single',
                occupation: 'Test',
                phone: '+502 1234-5678',
                visitDate: new Date()
            });
        });

        it('should find patient by phone number', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients/search/phone/1234'
            });

            expect(response.statusCode).toBe(200);
            const patient = JSON.parse(response.payload);
            expect(patient.firstName).toBe('Phone');
            expect(patient.phone).toBe('+502 1234-5678');
        });

        it('should return 404 for non-existent phone', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/patients/search/phone/9999'
            });

            expect(response.statusCode).toBe(404);
            const error = JSON.parse(response.payload);
            expect(error.error).toBe('Not Found');
        });
    });
});