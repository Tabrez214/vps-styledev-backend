import cron from 'node-cron';
import EmailCampaignService from './emailCampaignService';

export class CronService {
  
  /**
   * Initialize all cron jobs
   */
  static initializeCronJobs(): void {
    console.log('Initializing cron jobs...');

    // Process pending email campaigns every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('Running email campaign processor...');
      try {
        await EmailCampaignService.processPendingCampaigns();
      } catch (error) {
        console.error('Error in email campaign cron job:', error);
      }
    });

    // Clean up old campaigns daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running email campaign cleanup...');
      try {
        await EmailCampaignService.cleanupOldCampaigns();
      } catch (error) {
        console.error('Error in cleanup cron job:', error);
      }
    });

    // Log campaign statistics daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Generating email campaign statistics...');
      try {
        const stats = await EmailCampaignService.getCampaignStats();
        console.log('Email Campaign Stats:', JSON.stringify(stats, null, 2));
      } catch (error) {
        console.error('Error generating campaign stats:', error);
      }
    });

    console.log('Cron jobs initialized successfully');
  }

  /**
   * Stop all cron jobs (useful for testing or graceful shutdown)
   */
  static stopAllCronJobs(): void {
    cron.getTasks().forEach((task) => {
      task.stop();
    });
    console.log('All cron jobs stopped');
  }
}

export default CronService;