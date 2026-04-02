import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Escape user-supplied strings before inserting into HTML email templates
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const FROM_EMAIL = process.env.FROM_EMAIL || "Total Wins <admin@totalwins.app>";
const APP_URL = process.env.APP_URL || "https://totalwins.app";

// Single pre-rendered header image — gradient + logo + Russo One text baked in.
// Renders identically in every email client regardless of font/image blocking.
const LOGO_HTML = `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FF1493;">
    <tr>
      <td style="padding:0;font-size:0;line-height:0;">
        <img src="${APP_URL}/email-header.png" alt="Total Wins — Wins Pool Championship" width="600" style="display:block;border:0;max-width:100%;height:auto;" />
      </td>
    </tr>
  </table>
`;

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
      console.log(`Email sent successfully`);
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
    const safePlayerName = escapeHtml(playerName);
    const safeLeagueName = escapeHtml(leagueName);
    const safeAdminName = escapeHtml(adminName);
    const safeSport = escapeHtml(sport);
    const signupUrl = `${APP_URL}/signup?invite=${encodeURIComponent(inviteCode)}`;
    const joinUrl = `${APP_URL}/join?code=${encodeURIComponent(inviteCode)}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="format-detection" content="telephone=no">
        <meta name="x-apple-disable-message-reformatting">
        <title>You're Invited to Join ${leagueName}!</title>
        <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet" type="text/css">
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%);
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
            background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%);
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
            border-left: 4px solid #FF1493;
          }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%);
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold;
            font-size: 16px;
            margin: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
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
            background: #8A2BE2;
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
          ${LOGO_HTML}
          <div class="header">
            <h1>YOU'RE INVITED</h1>
          </div>
          <div class="content">
            <h2>Hey ${safePlayerName}!</h2>
            <p><strong>${safeAdminName}</strong> has invited you to join their Total Wins league:</p>
            
            <div class="league-info">
              <h3>${safeLeagueName}</h3>
              <span class="sport-badge">${safeSport} League</span>
              <p>${safeSport === 'MLB' ? 'The baseball diamond awaits...' : safeSport === 'NFL' ? 'The gridiron awaits...' : safeSport === 'NBA' ? 'The hardwood awaits...' : 'The season awaits...'}</p>
            </div>

            <p>Use this invite code to join:</p>
            <div class="invite-code">${escapeHtml(inviteCode)}</div>

            <p><strong>New to Total Wins?</strong></p>
            <a href="${signupUrl}" class="cta-button">Sign Up & Join League</a>
            
            <p><strong>Already have an account?</strong></p>
            <a href="${joinUrl}" class="cta-button">Join League Now</a>

            <p>Total Wins is the ultimate wins pool league system with live scoring, real-time standings and quick drafting. Join your friends, compete to draft the best roster of teams and dominate your league in Total Wins.</p>
          </div>
          <div class="footer">
            <p>This invitation was sent by ${safeAdminName} through Total Wins.<br>
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
    leagueId: string,
    draftedPicks: Array<{ pickNumber: number; teamName: string; teamAbbr: string; draftedBy: string }> = [],
    availableTeams: Array<{ name: string; abbreviation: string }> = []
  ): Promise<boolean> {
    const safePlayerName = escapeHtml(playerName);
    const safeLeagueName = escapeHtml(leagueName);
    const draftUrl = `${APP_URL}/draft?league=${encodeURIComponent(leagueId)}`;

    const draftedRowsHtml = draftedPicks.length > 0
      ? draftedPicks.map(p => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 12px; color: #888; font-size: 13px;">#${p.pickNumber}</td>
            <td style="padding: 8px 12px; font-weight: bold; font-size: 13px;">${escapeHtml(p.teamName)}</td>
            <td style="padding: 8px 12px; color: #555; font-size: 13px;">${escapeHtml(p.draftedBy)}</td>
          </tr>`).join('')
      : `<tr><td colspan="3" style="padding: 12px; color: #888; text-align: center; font-size: 13px;">No picks yet — you have first pick!</td></tr>`;

    const availableHtml = availableTeams.length > 0
      ? availableTeams.map(t => `<span style="display:inline-block; background:#f0f4ff; border:1px solid #c7d2fe; border-radius:4px; padding:4px 10px; margin:3px; font-size:12px; font-weight:bold; color:#3730a3;">${escapeHtml(t.name)}</span>`).join('')
      : `<p style="color:#888; font-size:13px;">All teams have been drafted.</p>`;

    const draftedTextRows = draftedPicks.length > 0
      ? draftedPicks.map(p => `  #${p.pickNumber}  ${p.teamAbbr.padEnd(5)}  ${p.teamName.padEnd(25)}  ${p.draftedBy}`).join('\n')
      : '  No picks yet — you have first pick!';

    const availableTextList = availableTeams.length > 0
      ? availableTeams.map(t => `  - ${t.name}`).join('\n')
      : '  All teams have been drafted.';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Turn to Draft</title>
        <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet" type="text/css">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f0f0f0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%); color: white; text-align: center; padding: 32px 24px; }
          .header h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px; }
          .header p { margin: 8px 0 0; font-size: 15px; opacity: 0.9; }
          .content { padding: 28px 32px; }
          .draft-info { background: #f8f9fa; border-left: 4px solid #FF1493; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
          .draft-info table { width: 100%; border-collapse: collapse; }
          .draft-info td { padding: 4px 0; font-size: 14px; }
          .draft-info td:first-child { color: #888; width: 80px; }
          .draft-info td:last-child { font-weight: bold; color: #1a1a1a; }
          .cta-button { display: inline-block; background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 16px 0; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 28px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          .picks-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; }
          .picks-table th { background: #f8f9fa; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
          .footer { background: #f8f9fa; padding: 18px 24px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          ${LOGO_HTML}
          <div class="header">
            <h1>YOUR TURN TO DRAFT</h1>
            <p>${safeLeagueName}</p>
          </div>
          <div class="content">
            <p style="font-size:16px;">Hi ${safePlayerName},</p>
            <p style="font-size:15px; color:#444;">It is your turn to make a selection in the ${safeLeagueName} draft.</p>

            <div class="draft-info">
              <table>
                <tr><td>League</td><td>${safeLeagueName}</td></tr>
                <tr><td>Round</td><td>${round}</td></tr>
                <tr><td>Pick</td><td>#${pickNumber}</td></tr>
              </table>
            </div>

            <div style="text-align:center; margin: 20px 0;">
              <a href="${draftUrl}" class="cta-button">Make Your Pick</a>
            </div>

            <div class="section-title">Teams Drafted So Far</div>
            <table class="picks-table">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Team</th>
                  <th>Drafted By</th>
                </tr>
              </thead>
              <tbody>
                ${draftedRowsHtml}
              </tbody>
            </table>

            <div class="section-title">Still Available (${availableTeams.length})</div>
            <div style="line-height: 2;">
              ${availableHtml}
            </div>
          </div>
          <div class="footer">
            <p>Total Wins &mdash; Draft Notification<br>
            Manage your notification preferences in your profile settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
YOUR TURN TO DRAFT
${leagueName}

Hi ${playerName},

It is your turn to make a selection in the ${leagueName} draft.

  League: ${leagueName}
  Round:  ${round}
  Pick:   #${pickNumber}

Make your pick here: ${draftUrl}

--- TEAMS DRAFTED SO FAR ---
${draftedTextRows}

--- STILL AVAILABLE (${availableTeams.length}) ---
${availableTextList}

Total Wins - Draft Notification
Manage your notification preferences in your profile settings.
    `;

    return this.sendEmail({
      to: email,
      subject: `Your turn to draft in ${leagueName} (Round ${round}, Pick #${pickNumber})`,
      htmlBody,
      textBody,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    playerName: string,
    resetUrl: string
  ): Promise<boolean> {
    const safePlayerName = escapeHtml(playerName);
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet" type="text/css">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f0f0f0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%); color: white; text-align: center; padding: 32px 24px; }
          .header h1 { margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 1px; }
          .header p { margin: 8px 0 0; font-size: 15px; opacity: 0.9; }
          .content { padding: 28px 32px; }
          .info-box { background: #f8f9fa; border-left: 4px solid #FF1493; border-radius: 6px; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: #555; }
          .cta-button { display: inline-block; background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 16px 0; }
          .footer { background: #f8f9fa; padding: 18px 24px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          ${LOGO_HTML}
          <div class="header">
            <h1>RESET YOUR PASSWORD</h1>
          </div>
          <div class="content">
            <p style="font-size:16px;">Hi ${safePlayerName},</p>
            <p style="font-size:15px; color:#444;">We received a request to reset the password for your Total Wins account. Click the button below to choose a new password.</p>

            <div style="text-align:center; margin: 24px 0;">
              <a href="${resetUrl}" class="cta-button">Reset My Password</a>
            </div>

            <div class="info-box">
              This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.
            </div>

            <p style="font-size:13px; color:#888; word-break:break-all;">
              If the button above does not work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color:#8A2BE2;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>Total Wins &mdash; Password Reset<br>
            If you did not request this, no action is needed.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `
RESET YOUR PASSWORD
Total Wins

Hi ${playerName},

We received a request to reset the password for your Total Wins account.

Reset your password here: ${resetUrl}

This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.

Total Wins - Password Reset
    `;

    return this.sendEmail({
      to: email,
      subject: `Reset your Total Wins password`,
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
    const safePlayerName = escapeHtml(playerName);
    const safeTeamName = escapeHtml(teamName);
    const safeTeamCity = escapeHtml(teamCity);
    const safeGameResult = escapeHtml(gameResult);
    const standingsUrl = `${APP_URL}/standings?league=${encodeURIComponent(leagueId)}`;
    const result = isWin ? "WON" : "LOST";

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Game Update: ${safeTeamCity} ${safeTeamName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Russo+One&display=swap" rel="stylesheet" type="text/css">
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%);
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
            background: linear-gradient(to right, #FF1493 0%, #8A2BE2 50%, #20B2AA 100%);
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
          ${LOGO_HTML}
          <div class="header">
            <h1>GAME UPDATE</h1>
          </div>
          <div class="content">
            <h2>Hey ${safePlayerName}!</h2>
            
            <p>Your team has a game update:</p>

            <div class="game-result">
              <h3>${safeTeamCity} ${safeTeamName}</h3>
              <h2 style="color: ${isWin ? '#28a745' : '#dc3545'}; margin: 10px 0;">${result}!</h2>
              <p><strong>${safeGameResult}</strong></p>
            </div>

            ${isWin 
              ? "<p>Congratulations! Your team picked up another win. Every victory counts in the standings!</p>" 
              : "<p>Tough loss, but there are plenty more games ahead. Your other teams might be doing better!</p>"
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
      GAME UPDATE

      Hey ${playerName}!

      Your team has a game update:

      ${teamCity} ${teamName} ${result}!
      ${gameResult}

      ${isWin 
        ? "Congratulations! Your team picked up another win. Every victory counts in the standings!" 
        : "Tough loss, but there are plenty more games ahead. Your other teams might be doing better!"
      }

      Check the updated standings: ${standingsUrl}

      Stay on top of your league with real-time game updates and live standings!

      This game update was sent from Total Wins.
    `;

    return this.sendEmail({
      to: email,
      subject: `${teamCity} ${teamName} ${result}! - ${gameResult}`,
      htmlBody,
      textBody,
    });
  }
}

export { EmailService };
export const emailService = new EmailService();
export default emailService;