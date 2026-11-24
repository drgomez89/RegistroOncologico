import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import breastRouter from "./breast";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(breastRouter);

export default router;
