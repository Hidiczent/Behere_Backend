import requireAuth from "../middlewares/requireAuth";
import requireAdmin from "../middlewares/requireAdmin";
import router from "./auth";
import { listReports } from "../controllers/admin.reports.controller";

router.get("/admin/reports", requireAuth, requireAdmin, listReports);

export default router;