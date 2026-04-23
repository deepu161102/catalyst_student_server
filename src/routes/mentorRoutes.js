const express = require('express');
const router  = express.Router();
const { getAllMentors, getMentorById, createMentor, updateMentor, deleteMentor } = require('../controllers/mentorController');

router.route('/').get(getAllMentors).post(createMentor);
router.route('/:id').get(getMentorById).put(updateMentor).delete(deleteMentor);

module.exports = router;
