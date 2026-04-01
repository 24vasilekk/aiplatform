import {
  createDatasetFile,
  enqueueDailyMetricsRecomputeJob,
  enqueueDatasetFileProcessingJob,
  executePendingJobs,
  findDatasetFileById,
  updateDatasetFileProcessingStatus,
} from "@/lib/db";

export const WriteOps = {
  createDatasetFile,
  enqueueDailyMetricsRecomputeJob,
  enqueueDatasetFileProcessingJob,
  executePendingJobs,
  findDatasetFileById,
  updateDatasetFileProcessingStatus,
};

