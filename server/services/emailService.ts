import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const FROM_EMAIL = process.env.FROM_EMAIL || "Total Wins <admin@totalwins.app>";
const APP_URL = process.env.APP_URL || "https://totalwins.app";

class EmailService {
  async sendEmail(params: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  }): Promise<boolean> {
    try {
      const command = new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: params.htmlBody,
              Charset: "UTF-8",
            },
            Text: {
              Data: params.textBody || params.htmlBody.replace(/<[^>]*>/g, ""),
              Charset: "UTF-8",
            },
          },
        },
        Tags: [
          {
            Name: "EmailType",
            Value: "TotalWinsNotification"
          }
        ]
      });

      await sesClient.send(command);
      console.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendLeagueInvitation(
    email: string,
    playerName: string,
    leagueName: string,
    adminName: string,
    inviteCode: string,
    sport: string
  ): Promise<boolean> {
    const signupUrl = `${APP_URL}/signup?invite=${inviteCode}`;
    const joinUrl = `${APP_URL}/join?code=${inviteCode}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <meta name="x-apple-disable-message-reformatting">
        <title>You're Invited to Join ${leagueName}!</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #ff1493 0%, #8a2be2 50%, #4169e1 100%);
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #ff1493 0%, #20b2aa 100%);
            color: white; 
            text-align: center; 
            padding: 30px 20px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          .content { 
            padding: 30px; 
            text-align: center;
          }
          .league-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #20b2aa;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #ff1493 0%, #20b2aa 100%);
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold;
            font-size: 16px;
            margin: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
          }
          .invite-code {
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            color: #495057;
            letter-spacing: 2px;
            margin: 15px 0;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666;
            font-size: 14px;
          }
          .sport-badge {
            display: inline-block;
            background: #20b2aa;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TOTAL WINS INVITATION</h1>
          </div>
          <div class="content">
            <h2>Hey ${playerName}!</h2>
            <p><strong>${adminName}</strong> has invited you to join their Total Wins league:</p>
            
            <div class="league-info">
              <h3>${leagueName}</h3>
              <span class="sport-badge">${sport} League</span>
              <p>${sport === 'MLB' ? 'The baseball diamond awaits...' : sport === 'NFL' ? 'The gridiron awaits...' : sport === 'NBA' ? 'The hardwood awaits...' : 'The season awaits...'}</p>
            </div>

            <p>Use this invite code to join:</p>
            <div class="invite-code">${inviteCode}</div>

            <p><strong>New to Total Wins?</strong></p>
            <a href="${signupUrl}" class="cta-button">Sign Up & Join League</a>
            
            <p><strong>Already have an account?</strong></p>
            <a href="${joinUrl}" class="cta-button">Join League Now</a>

            <p>Total Wins is the ultimate wins pool league system with live scoring, real-time standings and quick drafting. Join your friends, compete to draft the best roster of teams and dominate your league in Total Wins.</p>
          </div>
          <div class="footer">
            <p>This invitation was sent by ${adminName} through Total Wins.<br>
            If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      TOTAL WINS INVITATION

      Hey ${playerName}!

      ${adminName} has invited you to join their Total Wins league: ${leagueName}

      ${sport === 'MLB' ? 'The baseball diamond awaits...' : sport === 'NFL' ? 'The gridiron awaits...' : sport === 'NBA' ? 'The hardwood awaits...' : 'The season awaits...'}

      Use this invite code to join: ${inviteCode}

      New to Total Wins? Sign up here: ${signupUrl}
      Already have an account? Join here: ${joinUrl}

      Total Wins is the ultimate wins pool league system with live scoring, real-time standings and quick drafting. Join your friends, compete to draft the best roster of teams and dominate your league in Total Wins.

      This invitation was sent by ${adminName} through Total Wins.
    `;

    return this.sendEmail({
      to: email,
      subject: `You're invited to join ${leagueName} on Total Wins!`,
      htmlBody,
      textBody,
    });
  }

  async sendDraftNotification(
    email: string,
    playerName: string,
    leagueName: string,
    round: number,
    pickNumber: number,
    leagueId: string
  ): Promise<boolean> {
    const draftUrl = `${APP_URL}/draft?league=${leagueId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Turn to Draft!</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #ff1493 0%, #8a2be2 50%, #4169e1 100%);
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white; 
            text-align: center; 
            padding: 30px 20px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          .content { 
            padding: 30px; 
            text-align: center;
          }
          .draft-info {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold;
            font-size: 18px;
            margin: 15px 0;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666;
            font-size: 14px;
          }
          .urgent {
            background: #dc3545;
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 YOUR TURN TO DRAFT! 🎯</h1>
          </div>
          <div class="content">
            <h2>Hey ${playerName}!</h2>
            
            <div class="urgent">
              ⏰ It's your turn to make a pick!
            </div>

            <div class="draft-info">
              <h3>${leagueName}</h3>
              <p><strong>Round:</strong> ${round}</p>
              <p><strong>Pick:</strong> #${pickNumber}</p>
            </div>

            <p>Don't keep your league mates waiting! Head over to the draft room and make your selection.</p>

            <a href="${draftUrl}" class="cta-button">Make Your Pick Now</a>

            <p><em>Remember: Choose wisely! Your team's success depends on picking the teams with the most wins this season.</em></p>
          </div>
          <div class="footer">
            <p>This draft notification was sent from Total Wins.<br>
            You can manage your notification preferences in your profile settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      🎯 YOUR TURN TO DRAFT! 🎯

      Hey ${playerName}!

      ⏰ It's your turn to make a pick in ${leagueName}!

      Round: ${round}
      Pick: #${pickNumber}

      Don't keep your league mates waiting! Make your selection here: ${draftUrl}

      Remember: Choose wisely! Your team's success depends on picking the teams with the most wins this season.

      This draft notification was sent from Total Wins.
    `;

    return this.sendEmail({
      to: email,
      subject: `🎯 Your turn to draft in ${leagueName}! (Round ${round}, Pick #${pickNumber})`,
      htmlBody,
      textBody,
    });
  }

  async sendGameUpdateNotification(
    email: string,
    playerName: string,
    teamName: string,
    teamCity: string,
    isWin: boolean,
    gameResult: string,
    opponent: string,
    leagueId: string
  ): Promise<boolean> {
    const standingsUrl = `${APP_URL}/standings?league=${leagueId}`;
    const result = isWin ? "WON" : "LOST";
    const emoji = isWin ? "🎉" : "😔";

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Game Update: ${teamCity} ${teamName}</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #ff1493 0%, #8a2be2 50%, #4169e1 100%);
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header { 
            background: ${isWin ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)'};
            color: white; 
            text-align: center; 
            padding: 30px 20px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          .content { 
            padding: 30px; 
            text-align: center;
          }
          .game-result {
            background: ${isWin ? '#d4edda' : '#f8d7da'};
            border: 2px solid ${isWin ? '#28a745' : '#dc3545'};
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #6f42c1 0%, #20b2aa 100%);
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold;
            font-size: 16px;
            margin: 15px 0;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
          }
          .cta-button:hover {
            transform: translateY(-2px);
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${emoji} GAME UPDATE ${emoji}</h1>
          </div>
          <div class="content">
            <h2>Hey ${playerName}!</h2>
            
            <p>Your team has a game update:</p>

            <div class="game-result">
              <h3>${teamCity} ${teamName}</h3>
              <h2 style="color: ${isWin ? '#28a745' : '#dc3545'}; margin: 10px 0;">${result}!</h2>
              <p><strong>${gameResult}</strong></p>
            </div>

            ${isWin 
              ? "<p>🎉 Congratulations! Your team picked up another win. Every victory counts in the standings!</p>" 
              : "<p>😔 Tough loss, but there are plenty more games ahead. Your other teams might be doing better!</p>"
            }

            <a href="${standingsUrl}" class="cta-button">Check Updated Standings</a>

            <p><em>Stay on top of your league with real-time game updates and live standings!</em></p>
          </div>
          <div class="footer">
            <p>This game update was sent from Total Wins.<br>
            You can manage your notification preferences in your profile settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
      ${emoji} GAME UPDATE ${emoji}

      Hey ${playerName}!

      Your team has a game update:

      ${teamCity} ${teamName} ${result}!
      ${gameResult}

      ${isWin 
        ? "🎉 Congratulations! Your team picked up another win. Every victory counts in the standings!" 
        : "😔 Tough loss, but there are plenty more games ahead. Your other teams might be doing better!"
      }

      Check the updated standings: ${standingsUrl}

      Stay on top of your league with real-time game updates and live standings!

      This game update was sent from Total Wins.
    `;

    return this.sendEmail({
      to: email,
      subject: `${emoji} ${teamCity} ${teamName} ${result}! - ${gameResult}`,
      htmlBody,
      textBody,
    });
  }
}

export { EmailService };
export const emailService = new EmailService();
export default emailService;