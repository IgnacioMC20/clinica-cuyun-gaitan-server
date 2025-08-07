import { FastifyPluginAsync } from 'fastify';
import { Patient } from './models/Patient';
import { requireSession } from './middleware/requireAuth';

const routes: FastifyPluginAsync = async (app) => {
    // GET /api/stats - Get patient statistics
    app.get('/stats', async (request, reply) => {
        try {
            // Get basic stats using aggregation
            const stats = await Patient.aggregate([
                {
                    $addFields: {
                        age: {
                            $cond: {
                                if: { $ne: ['$birthdate', null] },
                                then: {
                                    $floor: {
                                        $divide: [
                                            { $subtract: [new Date(), '$birthdate'] },
                                            365.25 * 24 * 60 * 60 * 1000
                                        ]
                                    }
                                },
                                else: 0
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
                        female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
                        children: { $sum: { $cond: [{ $eq: ['$gender', 'child'] }, 1, 0] } },
                        averageAge: { $avg: '$age' }
                    }
                }
            ]);

            const recentVisits = await Patient.countDocuments({
                visitDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });

            const response = {
                total: stats[0]?.total || 0,
                male: stats[0]?.male || 0,
                female: stats[0]?.female || 0,
                children: stats[0]?.children || 0,
                averageAge: Math.round(stats[0]?.averageAge || 0),
                recentVisits
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error fetching stats:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch statistics'
            });
        }
    });

    // GET /api/patients - List patients with search and pagination
    app.get('/patients', async (request, reply) => {
        try {
            const query = request.query as {
                query?: string;
                gender?: string;
                ageMin?: string;
                ageMax?: string;
                limit?: string;
                offset?: string;
            };

            const {
                query: searchQuery = '',
                gender,
                ageMin,
                ageMax,
                limit = '10',
                offset = '0'
            } = query;

            const limitNum = Math.min(parseInt(String(limit)) || 10, 100);
            const offsetNum = parseInt(String(offset)) || 0;

            // Build search filter
            const filter: Record<string, any> = {};

            // Text search
            if (searchQuery && String(searchQuery).trim()) {
                filter.$text = { $search: String(searchQuery).trim() };
            }

            // Gender filter
            if (gender && ['male', 'female', 'child'].includes(String(gender))) {
                filter.gender = gender;
            }

            // Age range filter - we'll need to use aggregation for this
            let pipeline: any[] = [];

            // Start with match stage for other filters
            if (Object.keys(filter).length > 0) {
                pipeline.push({ $match: filter });
            }

            // Add age calculation if age filtering is needed
            if (ageMin || ageMax) {
                pipeline.push({
                    $addFields: {
                        calculatedAge: {
                            $cond: {
                                if: { $ne: ['$birthdate', null] },
                                then: {
                                    $floor: {
                                        $divide: [
                                            { $subtract: [new Date(), '$birthdate'] },
                                            365.25 * 24 * 60 * 60 * 1000
                                        ]
                                    }
                                },
                                else: 0
                            }
                        }
                    }
                });

                const ageFilter: any = {};
                if (ageMin) ageFilter.$gte = parseInt(String(ageMin));
                if (ageMax) ageFilter.$lte = parseInt(String(ageMax));

                pipeline.push({
                    $match: { calculatedAge: ageFilter }
                });
            }

            // Add sorting and pagination
            pipeline.push(
                { $sort: { createdAt: -1 } },
                { $skip: offsetNum },
                { $limit: limitNum }
            );

            // Execute query with pagination
            let patients, total;

            if (pipeline.length > 0) {
                // Use aggregation pipeline for age filtering
                const [patientsResult, totalResult] = await Promise.all([
                    Patient.aggregate(pipeline),
                    Patient.aggregate([
                        ...pipeline.slice(0, -2), // Remove skip and limit for count
                        { $count: "total" }
                    ])
                ]);
                patients = patientsResult;
                total = totalResult[0]?.total || 0;
            } else {
                // Use simple find for non-age filtering
                [patients, total] = await Promise.all([
                    Patient.find(filter)
                        .sort({ createdAt: -1 })
                        .limit(limitNum)
                        .skip(offsetNum)
                        .lean(),
                    Patient.countDocuments(filter)
                ]);
            }

            // Transform response
            const response = {
                patients: patients.map((patient: any) => ({
                    ...patient,
                    id: patient._id.toString(),
                    createdAt: patient.createdAt.toISOString(),
                    updatedAt: patient.updatedAt.toISOString(),
                    visitDate: new Date(patient.visitDate).toISOString()
                })),
                total,
                limit: limitNum,
                offset: offsetNum
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error fetching patients:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch patients'
            });
        }
    });

    // GET /api/patients/search/phone/:phone - Search patient by phone
    app.get('/patients/search/phone/:phone', async (request, reply) => {
        try {
            const { phone } = request.params as { phone: string };

            const patient = await Patient.findOne({
                phone: { $regex: phone.replace(/\D/g, ''), $options: 'i' }
            }).lean();

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found with this phone number'
                });
            }

            // Transform response
            const response = {
                ...patient,
                id: (patient as any)._id.toString(),
                createdAt: (patient as any).createdAt.toISOString(),
                updatedAt: (patient as any).updatedAt.toISOString(),
                visitDate: new Date((patient as any).visitDate).toISOString(),
                ...((patient as any).birthdate && { birthdate: new Date((patient as any).birthdate).toISOString() }),
                notes: (patient as any).notes?.map((note: any) => ({
                    ...note.toObject(),
                    id: note._id.toString(),
                    date: new Date(note.date).toISOString()
                })) || []
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error searching by phone:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to search by phone'
            });
        }
    });

    // GET /api/patients/:id - Get single patient
    app.get('/patients/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };

            const patient = await Patient.findById(id).lean();

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found'
                });
            }

            // Transform response
            const response = {
                ...patient,
                id: (patient as any)._id.toString(),
                createdAt: (patient as any).createdAt.toISOString(),
                updatedAt: (patient as any).updatedAt.toISOString(),
                visitDate: new Date((patient as any).visitDate).toISOString(),
                notes: (patient as any).notes?.map((note: any) => ({
                    ...note,
                    id: note._id?.toString(),
                    date: new Date(note.date).toISOString()
                })) || []
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error fetching patient:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch patient'
            });
        }
    });

    // POST /api/patients - Create new patient
    app.post('/patients', async (request, reply) => {
        try {
            const patientData = request.body as any;

            // Create new patient
            const patient = new Patient({
                ...patientData,
                ...(patientData.birthdate && { birthdate: new Date(patientData.birthdate) }),
                visitDate: new Date(patientData.visitDate),
                notes: patientData.notes?.map((note: any) => ({
                    ...note,
                    date: new Date()
                })) || []
            });

            await patient.save();

            // Transform response
            const response = {
                ...patient.toObject(),
                id: patient._id.toString(),
                createdAt: patient.createdAt.toISOString(),
                updatedAt: patient.updatedAt.toISOString(),
                visitDate: new Date(patient.visitDate).toISOString()
            };

            return reply.status(201).send(response);
        } catch (error: any) {
            request.log.error('Error creating patient:', error);

            // Handle validation errors
            if (error.name === 'ValidationError') {
                const errors = Object.values(error.errors).map((err: any) => ({
                    field: err.path,
                    message: err.message
                }));
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'Invalid patient data',
                    details: errors
                });
            }

            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to create patient'
            });
        }
    });

    // PUT /api/patients/:id - Update patient
    app.put('/patients/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const updateData = request.body as any;

            // Remove id from update data
            delete updateData.id;

            // Convert dates if provided
            if (updateData.visitDate) {
                updateData.visitDate = new Date(updateData.visitDate);
            }
            if (updateData.birthdate) {
                updateData.birthdate = new Date(updateData.birthdate);
            }

            const patient = await Patient.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).lean();

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found'
                });
            }

            // Transform response
            const response = {
                ...patient,
                id: (patient as any)._id.toString(),
                createdAt: (patient as any).createdAt.toISOString(),
                updatedAt: (patient as any).updatedAt.toISOString(),
                visitDate: new Date((patient as any).visitDate).toISOString()
            };

            return reply.send(response);
        } catch (error: any) {
            request.log.error('Error updating patient:', error);

            // Handle validation errors
            if (error.name === 'ValidationError') {
                const errors = Object.values(error.errors).map((err: any) => ({
                    field: err.path,
                    message: err.message
                }));
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'Invalid patient data',
                    details: errors
                });
            }

            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to update patient'
            });
        }
    });

    // DELETE /api/patients/:id - Delete patient
    app.delete('/patients/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };

            const patient = await Patient.findByIdAndDelete(id);

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found'
                });
            }

            return reply.send({
                message: 'Patient deleted successfully',
                id: patient._id.toString()
            });
        } catch (error) {
            request.log.error('Error deleting patient:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to delete patient'
            });
        }
    });

    // POST /api/patients/:id/notes - Add note to patient
    app.post('/patients/:id/notes', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const { title, content } = request.body as { title: string; content: string };

            if (!title || !content) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: 'Title and content are required'
                });
            }

            const patient = await Patient.findById(id);

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found'
                });
            }

            // Add new note
            const newNote = {
                title: title.trim(),
                content: content.trim(),
                date: new Date()
            };

            patient.notes.push(newNote);
            await patient.save();

            // Transform response
            const response = {
                ...patient.toObject(),
                id: patient._id.toString(),
                createdAt: patient.createdAt.toISOString(),
                updatedAt: patient.updatedAt.toISOString(),
                visitDate: new Date(patient.visitDate).toISOString(),
                ...(patient.birthdate && { birthdate: new Date(patient.birthdate).toISOString() })
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error adding note:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to add note'
            });
        }
    });

    // DELETE /api/patients/:id/notes/:noteId - Delete specific note from patient
    app.delete('/patients/:id/notes/:noteId', async (request, reply) => {
        try {
            const { id, noteId } = request.params as { id: string; noteId: string };

            const patient = await Patient.findById(id);

            if (!patient) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Patient not found'
                });
            }

            // Find and remove the note using MongoDB's pull method
            const originalNotesLength = patient.notes.length;
            patient.notes = patient.notes.filter((note: any) => note._id?.toString() !== noteId);

            if (patient.notes.length === originalNotesLength) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Note not found'
                });
            }

            await patient.save();

            // Transform response
            const response = {
                ...patient.toObject(),
                id: patient._id.toString(),
                createdAt: patient.createdAt.toISOString(),
                updatedAt: patient.updatedAt.toISOString(),
                visitDate: new Date(patient.visitDate).toISOString()
            };

            return reply.send(response);
        } catch (error) {
            request.log.error('Error deleting note:', error);
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to delete note'
            });
        }
    });
};

export default routes;
