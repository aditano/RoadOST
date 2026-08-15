export const getHourLocal = (date: Date = new Date()): number => {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
};
