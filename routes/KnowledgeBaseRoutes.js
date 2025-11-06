const router = require("express").Router();
const KnowledgeBaseController = require("../app/Http/Controllers/v1/KnowledgeBaseController");
const authCtrl = require("../app/Http/Controllers/v1/AuthController");

// Get knowledge base statistics
router.get("/stats", authCtrl.authenticate, KnowledgeBaseController.getStats);

// Upload document (PDF or TXT)
router.post(
  "/upload",
  authCtrl.authenticate,
  KnowledgeBaseController.uploadDocument
);

// Add manual text document
router.post("/add", authCtrl.authenticate, KnowledgeBaseController.addDocument);

// Search knowledge base
router.post(
  "/search",
  authCtrl.authenticate,
  KnowledgeBaseController.searchKnowledgeBase
);

// List all documents
router.get(
  "/documents",
  authCtrl.authenticate,
  KnowledgeBaseController.listDocuments
);

// Delete document by fileId
router.delete(
  "/documents/:fileId",
  authCtrl.authenticate,
  KnowledgeBaseController.deleteDocument
);

// Clear entire knowledge base
router.delete(
  "/clear",
  authCtrl.authenticate,
  KnowledgeBaseController.clearKnowledgeBase
);

// Add quick document (FAQ, Troubleshooting, etc.)
router.post(
  "/quick-add",
  authCtrl.authenticate,
  KnowledgeBaseController.addQuickDocument
);

module.exports = router;
