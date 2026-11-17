import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Activity input must be an object'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' ||
    !mongoose.isValidObjectId(userId) ||
    typeof teamId !== 'string' ||
    !mongoose.isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw Object.assign(new Error('Activity input is invalid'), { status: 400 });
  }

  const [user, team] = await Promise.all([User.findById(userId), Team.findById(teamId)]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity user or team was not found'), { status: 404 });
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Team input must be an object'), { status: 400 });
  }

  const { name, mascot, members } = input as Record<string, unknown>;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof mascot !== 'string' ||
    !mascot.trim() ||
    (members !== undefined &&
      (!Array.isArray(members) ||
        members.some((member) => typeof member !== 'string' || !mongoose.isValidObjectId(member))))
  ) {
    throw Object.assign(new Error('Team input is invalid'), { status: 400 });
  }

  const memberIds = (members ?? []) as string[];
  const users = await Promise.all(memberIds.map((memberId) => User.findById(memberId)));
  if (users.some((user) => !user)) {
    throw Object.assign(new Error('One or more team members were not found'), { status: 404 });
  }

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: users.map((user) => user!._id),
  });
}

export async function getLeaderboard() {
  const [activities, teams] = await Promise.all([
    Activity.find().select('team points').lean(),
    Team.find().select('name').lean(),
  ]);
  const pointsByTeam = new Map<string, number>();

  for (const activity of activities) {
    const teamId = activity.team.toString();
    pointsByTeam.set(teamId, (pointsByTeam.get(teamId) ?? 0) + activity.points);
  }

  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail });
  if (!user) {
    throw Object.assign(new Error('User was not found'), { status: 404 });
  }

  const [activities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).sort({ occurredAt: -1 }).lean(),
    Workout.find().lean(),
  ]);
  const activityFocus = (type: string) => {
    switch (type.toLowerCase()) {
      case 'run':
      case 'cycle':
      case 'walk':
        return 'endurance';
      case 'strength':
        return 'strength';
      default:
        return type.toLowerCase();
    }
  };

  return workouts
    .map((workout) => {
      const matchingActivity = activities.find(
        (activity) => activityFocus(activity.type) === workout.focus.toLowerCase(),
      );
      const matchesGoal = workout.focus.toLowerCase() === user.fitnessGoal.toLowerCase();
      return {
        ...workout,
        reason: matchingActivity
          ? `Matches your ${matchingActivity.type} activity.`
          : matchesGoal
            ? `Supports your ${user.fitnessGoal} goal.`
            : `Suggested based on your ${activities.length ? 'activity' : 'goal'}.`,
        score: Number(Boolean(matchingActivity)) + Number(matchesGoal),
      };
    })
    .sort((left, right) => right.score - left.score)
    .map(({ score: _score, ...suggestion }) => suggestion);
}

export { User };
