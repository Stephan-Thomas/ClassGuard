import { Router, Response } from 'express';
import { StudentModel, FaceTemplateModel, AuditLogModel, EnrollmentModel } from '../../models/index.js';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth.js';
import { StudentCreateSchema } from '@classguard/shared';

export const studentsRouter = Router();

studentsRouter.use(authenticate);

// List students with search and pagination
studentsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { query, department, level, page = '1', limit = '50' } = req.query;
    const filter: Record<string, any> = {};

    if (department) filter.department = department;
    if (level) filter.level = level;
    if (query) {
      filter.$or = [
        { matricNumber: new RegExp(String(query), 'i') },
        { fullName: new RegExp(String(query), 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10)));
    const skip = (pageNum - 1) * limitNum;

    const [students, total] = await Promise.all([
      StudentModel.find(filter).sort({ matricNumber: 1 }).skip(skip).limit(limitNum),
      StudentModel.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: students.map((s: any) => ({
        id: s._id.toString(),
        matricNumber: s.matricNumber,
        fullName: s.fullName,
        department: s.department,
        level: s.level,
        email: s.email,
        active: s.active,
        hasFaceEnrolled: s.hasFaceEnrolled,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get single student by ID
studentsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const student: any = await StudentModel.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const enrollments = await EnrollmentModel.find({ studentId: student._id }).populate('courseId');

    return res.json({
      success: true,
      data: {
        id: student._id.toString(),
        matricNumber: student.matricNumber,
        fullName: student.fullName,
        department: student.department,
        level: student.level,
        email: student.email,
        active: student.active,
        hasFaceEnrolled: student.hasFaceEnrolled,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
        enrollments,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create student (Admin only)
studentsRouter.post('/', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = StudentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const existing = await StudentModel.findOne({ matricNumber: parsed.data.matricNumber.toUpperCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'A student with this matric number already exists' });
    }

    const student: any = await StudentModel.create({
      matricNumber: parsed.data.matricNumber.toUpperCase(),
      fullName: parsed.data.fullName,
      department: parsed.data.department,
      level: parsed.data.level,
      email: parsed.data.email || undefined,
      active: true,
      hasFaceEnrolled: false,
    });

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: student._id.toString(),
      details: `Created student ${student.matricNumber} (${student.fullName})`,
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        id: student._id.toString(),
        matricNumber: student.matricNumber,
        fullName: student.fullName,
        department: student.department,
        level: student.level,
        email: student.email,
        active: student.active,
        hasFaceEnrolled: student.hasFaceEnrolled,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Enroll / Update Face Template
studentsRouter.post('/:id/enroll-face', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { embedding, algorithm = 'FaceRecognitionNet-128D' } = req.body;
    if (!Array.isArray(embedding) || embedding.length !== 128) {
      return res.status(400).json({ success: false, error: 'Embedding must be a 128-dimensional array' });
    }

    const student: any = await StudentModel.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    await FaceTemplateModel.findOneAndUpdate(
      { studentId: student._id },
      {
        studentId: student._id,
        matricNumber: student.matricNumber,
        embedding,
        algorithm,
        version: '1.0',
        sampleCount: 1,
      },
      { upsert: true, new: true }
    );

    student.hasFaceEnrolled = true;
    await student.save();

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'BIOMETRIC_ENROLLED',
      entityType: 'FaceTemplate',
      entityId: student._id.toString(),
      details: `Enrolled facial representation for student ${student.matricNumber}`,
      timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Face representation enrolled successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Face Template (Privacy Compliance)
studentsRouter.delete('/:id/face', authorize('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const student: any = await StudentModel.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    await FaceTemplateModel.deleteOne({ studentId: student._id });
    student.hasFaceEnrolled = false;
    await student.save();

    await AuditLogModel.create({
      userId: req.user?.id,
      username: req.user?.fullName,
      action: 'BIOMETRIC_DELETED',
      entityType: 'FaceTemplate',
      entityId: student._id.toString(),
      details: `Deleted facial biometric data for student ${student.matricNumber}`,
      timestamp: new Date(),
    });

    return res.json({ success: true, message: 'Face representation removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
