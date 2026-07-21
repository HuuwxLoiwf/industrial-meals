// Quản lý instance Socket.io toàn cục để các route phát sự kiện realtime.
let io = null;

export function setIo(instance) {
  io = instance;
}

export function emitEvent(event, payload) {
  if (io) io.emit(event, payload);
}

// Các sự kiện realtime dùng chung
export const EVENTS = {
  REGISTRATION_CREATED: 'registration:created',
  REGISTRATION_UPDATED: 'registration:updated',
  DISH_VOTE_UPDATED: 'dish-vote:updated',
  MENU_UPDATED: 'menu:updated',
};
