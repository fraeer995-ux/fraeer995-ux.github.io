import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useApp } from "../context";

export function DemoInfo() {
  const { config } = useApp();
  return (
    <section className="booking-page">
      <Link className="back-link" to="/"><ArrowLeft size={18} /> На главную</Link>
      <div className="booking-heading">
        <h1>Попробуйте запись.</h1>
        <p>Барбершоп вымышленный. Попробуйте весь путь записи в браузере.</p>
      </div>
      <div className="demo-note">
        <ShieldCheck size={24} />
        <p>Демонстрация для портфолио.<br /><span>Записи создаются только в этом проекте. Реального посещения, оплаты или звонка не будет.</span></p>
      </div>
      <ol className="demo-guide">
        <li><strong>Нажмите «Попробовать запись».</strong><p>Вход свободный. Установка Telegram и регистрация не нужны.</p></li>
        <li><strong>Выберите услугу, мастера и время.</strong><p>Демо проверяет свободные интервалы, длительность услуги и обеденный перерыв.</p></li>
        <li><strong>Подтвердите демонстрационную запись.</strong><p>Укажите вымышленное имя. Запись сохранится только в вашем браузере; сообщения не отправляются.</p></li>
        <li><strong>Попробуйте перенос, отмену и админку.</strong><p>Откройте «Мои записи» или «Администратору». Админка доступна без пароля, изменения услуг и записей сохраняются только у вас.</p></li>
      </ol>
      {config.portfolio_mode && <p className="muted">Одновременно можно иметь до {config.portfolio_booking_limit} предстоящих записей. Для новой отмените одну из существующих. Телефон в публичном демо не собирается.</p>}
      <p className="muted small">Полная серверная версия поддерживает Telegram, общее расписание и уведомления. Эта браузерная демонстрация показывает интерфейс и основные сценарии. Кнопка «Сбросить демо» удаляет ваши тестовые изменения.</p>
      {config.bot_url ? (
        <a className="primary" href={config.bot_url} target="_blank" rel="noreferrer">Открыть бота <ArrowRight size={18} /></a>
      ) : <Link className="primary" to="/book">Попробовать запись <ArrowRight size={18} /></Link>}
    </section>
  );
}


