declare module "nodemailer-otp" {
  export default class NodemailerHelper {
    constructor(email: string, password: string);
    sendEmail(
      recipient: string,
      subject: string,
      message: string,
      otp: string,
    ): Promise<{ success: boolean; message?: string }>;
  }
}
