const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  getStudentMentor,
  getStudentsByMentor,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');

// Specific routes before /:id to avoid param conflict
router.get('/by-mentor/:mentorId', getStudentsByMentor);

router.route('/').get(getAllStudents).post(createStudent);
router.route('/:id').get(getStudentById).put(updateStudent).delete(deleteStudent);
router.get('/:id/mentor', getStudentMentor);

module.exports = router;
