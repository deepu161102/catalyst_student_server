const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const protect  = require('../../middleware/auth');
const { requireOperations } = require('../../middleware/auth');
const {
  bulkUpload,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  getQuestionStats,
  createExamConfig,
  getExamConfigs,
  getExamConfigById,
  updateExamConfig,
  createFullLengthConfig,
  getFullLengthConfigs,
  updateFullLengthConfig,
  createPracticeConfig,
  getPracticeConfigs,
  updatePracticeConfig,
} = require('../../controllers/sat/satAdminController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(csv|tsv|txt|xlsx|xls)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

router.use(protect, requireOperations);

// Question bank
router.post('/question-bank/bulk-upload', upload.single('file'), bulkUpload);
router.get('/question-bank/stats',        getQuestionStats);
router.get('/question-bank',              getQuestions);
router.put('/question-bank/:id',          updateQuestion);
router.delete('/question-bank/:id',       deleteQuestion);

// Subject exam configs
router.route('/exam-configs')
  .get(getExamConfigs)
  .post(createExamConfig);

router.route('/exam-configs/:id')
  .get(getExamConfigById)
  .put(updateExamConfig);

// Full length exam configs
router.route('/full-length-configs')
  .get(getFullLengthConfigs)
  .post(createFullLengthConfig);

router.put('/full-length-configs/:id', updateFullLengthConfig);

// Practice test configs
router.route('/practice-configs')
  .get(getPracticeConfigs)
  .post(createPracticeConfig);

router.put('/practice-configs/:id', updatePracticeConfig);

module.exports = router;
