import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  console.warn("AWS credentials not configured. Email functionality will be disabled.");
}

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('AWS credentials not configured, skipping email send');
      return false;
    }

    const command = new SendEmailCommand({
      Source: params.from,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: {
          Data: params.subject,
          Charset: 'UTF-8',
        },
        Body: {
          ...(params.html && {
            Html: {
              Data: params.html,
              Charset: 'UTF-8',
            },
          }),
          ...(params.text && {
            Text: {
              Data: params.text,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    await sesClient.send(command);
    return true;
  } catch (error) {
    console.error('Amazon SES email error:', error);
    return false;
  }
}

export async function sendGameResultNotification(
  playerEmail: string,
  playerName: string,
  gameResult: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    week: number;
  }
): Promise<boolean> {
  const winner = gameResult.homeScore > gameResult.awayScore ? gameResult.homeTeam : gameResult.awayTeam;
  const loser = gameResult.homeScore > gameResult.awayScore ? gameResult.awayTeam : gameResult.homeTeam;
  
  return sendEmail({
    to: playerEmail,
    from: process.env.FROM_EMAIL || 'noreply@winspool.com',
    subject: `🏈 Week ${gameResult.week} Game Result - ${winner} wins!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ff1493, #8a2be2); padding: 20px; border-radius: 15px;">
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 20px;">🏆 GAME RESULT</h1>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin: 0 0 15px 0;">Week ${gameResult.week} Final Score</h2>
            <div style="font-size: 24px; font-weight: bold; color: #8a2be2;">
              ${gameResult.homeTeam} ${gameResult.homeScore} - ${gameResult.awayScore} ${gameResult.awayTeam}
            </div>
            <div style="margin-top: 15px; font-size: 18px; color: #28a745;">
              🎉 ${winner} WINS!
            </div>
          </div>
          <p style="color: #666; font-size: 16px;">Hi ${playerName}! Check your standings to see how this affects your league position.</p>
          <div style="margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/standings" 
               style="background: linear-gradient(135deg, #ff1493, #8a2be2); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              VIEW STANDINGS
            </a>
          </div>
        </div>
      </div>
    `,
    text: `
Week ${gameResult.week} Game Result:
${gameResult.homeTeam} ${gameResult.homeScore} - ${gameResult.awayScore} ${gameResult.awayTeam}
${winner} WINS!

Hi ${playerName}! Check your standings to see how this affects your league position.
View standings: ${process.env.APP_URL || 'http://localhost:5000'}/standings
    `
  });
}

export async function sendDraftReminderNotification(
  playerEmail: string,
  playerName: string,
  draftInfo: {
    currentPick: number;
    round: number;
    timeRemaining?: string;
  }
): Promise<boolean> {
  return sendEmail({
    to: playerEmail,
    from: process.env.FROM_EMAIL || 'noreply@winspool.com',
    subject: `🏈 It's Your Turn to Draft! Pick #${draftInfo.currentPick}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #00ced1, #32cd32); padding: 20px; border-radius: 15px;">
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 20px;">⏰ YOUR DRAFT TURN</h1>
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #ffc107;">
            <h2 style="color: #333; margin: 0 0 15px 0;">Round ${draftInfo.round} - Pick #${draftInfo.currentPick}</h2>
            <div style="font-size: 20px; font-weight: bold; color: #dc3545;">
              It's your turn to pick!
            </div>
            ${draftInfo.timeRemaining ? `<div style="margin-top: 10px; color: #666;">Time remaining: ${draftInfo.timeRemaining}</div>` : ''}
          </div>
          <p style="color: #666; font-size: 16px;">Hi ${playerName}! The draft is waiting for your selection. Choose your team wisely!</p>
          <div style="margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/draft" 
               style="background: linear-gradient(135deg, #00ced1, #32cd32); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              MAKE YOUR PICK
            </a>
          </div>
        </div>
      </div>
    `,
    text: `
It's Your Turn to Draft!
Round ${draftInfo.round} - Pick #${draftInfo.currentPick}

Hi ${playerName}! The draft is waiting for your selection. Choose your team wisely!
${draftInfo.timeRemaining ? `Time remaining: ${draftInfo.timeRemaining}` : ''}

Make your pick: ${process.env.APP_URL || 'http://localhost:5000'}/draft
    `
  });
}

export async function sendLeagueInvitation(
  playerEmail: string,
  inviterName: string,
  leagueName: string,
  inviteLink?: string
): Promise<boolean> {
  return sendEmail({
    to: playerEmail,
    from: process.env.FROM_EMAIL || 'noreply@winspool.com',
    subject: `🏈 You're Invited to Join ${leagueName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ff4500, #ff1493); padding: 20px; border-radius: 15px;">
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #333; font-size: 28px; margin-bottom: 20px;">🏆 LEAGUE INVITATION</h1>
          <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #007bff;">
            <h2 style="color: #333; margin: 0 0 15px 0;">${leagueName}</h2>
            <div style="font-size: 18px; color: #666;">
              ${inviterName} has invited you to join their Wins Pool league!
            </div>
          </div>
          <p style="color: #666; font-size: 16px;">Join the competition and draft your championship roster. May the best teams win!</p>
          <div style="margin-top: 30px;">
            <a href="${inviteLink || process.env.APP_URL || 'http://localhost:5000'}/signup" 
               style="background: linear-gradient(135deg, #ff4500, #ff1493); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              JOIN LEAGUE
            </a>
          </div>
        </div>
      </div>
    `,
    text: `
League Invitation: ${leagueName}

${inviterName} has invited you to join their Wins Pool league!
Join the competition and draft your championship roster. May the best teams win!

Join league: ${inviteLink || process.env.APP_URL || 'http://localhost:5000'}/signup
    `
  });
}