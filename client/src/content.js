export const TOURS = {
  student: [
    ['Welcome', 'This quick guide shows how to book an appointment. It takes four steps: choose a service, pick a date, pick a time, then verify with a code we email you.'],
    ['Find your service', 'Search for the document or service you need. We show the department and window that handle it, and the requirements you need to bring.'],
    ['Prepare your requirements', 'Each requirement can be text, an image, or both. After booking, tick items off as you prepare them. Staff will verify them at the window.'],
    ['On the appointment day', 'Open this page, select Check in, and show your QR code at the window. You will be called when it is your turn.'],
  ],
  staff: [
    ['Welcome', 'This dashboard controls your assigned window only. Changes here do not affect other windows.'],
    ['Run the queue', 'Scan student QR codes or add walk-ins, then select Call next student. A called student has 5 minutes to respond.'],
    ['Schedule and requirements', 'Change open days, hours and capacity, or close a date. Students whose bookings are affected can reschedule. You can also edit the requirements checklist, with text and images.'],
  ],
  admin: [
    ['Welcome', 'As an administrator you manage departments, windows, services, staff accounts and holidays, and you can operate any window.'],
    ['Set up the system', 'Follow the setup checklist on the Overview page. Use the window selector at the top to work on a specific window.'],
    ['Accountability', 'Every change is recorded in the Audit log, including who made it and when.'],
  ],
};
export const FAQ = {
  student: [
    ['How do I book an appointment?', 'Choose your service, select a date and a time, confirm, then enter the 6-digit code we email you. The booking is not final until you verify it.'],
    ['I did not receive my code', 'Check your spam folder, wait 30 seconds, then select Resend code. Codes expire after 5 minutes and allow 3 attempts.'],
    ['What do I do on the day?', 'Open this page, select Check in, and show your QR code at the window. Check-in is only available on the appointment date.'],
    ['Can I change my appointment?', 'If staff open rescheduling for you, a Reschedule option appears. Otherwise you can cancel the reservation and book again.'],
  ],
  staff: [
    ['How do I call the next student?', 'Select Call next student. The earliest appointment slot goes first, and within a slot the earliest check-in goes first. Walk-ins are served after booked students.'],
    ['A student did not respond', 'After 5 minutes the student is marked as missed automatically. Use Approve rejoin to place them at the end of the queue.'],
    ['How do I close a slot?', 'Open Schedule and add a closure for a date or a specific hour. Students with bookings in that period can then reschedule.'],
    ['How do I check a student out?', 'Open Scan QR code, switch to Check-out, and scan the same QR code again after service. The completion time is recorded by the server. A repeated scan is rejected.'],
    ['How do requirement checklists work?', 'Students tick items they have prepared. At the window, open the checklist for a student and verify each item. Items can include text, images or both.'],
  ],
  admin: [
    ['How do I add a window?', 'Open Organization, fill in the Add window form, then assign staff to it under People.'],
    ['How do I manage the course list?', 'Open Organization and scroll to Courses. Students pick from this list when they register. If the list is empty they type their course instead.'],
    ['How do I assign staff?', 'Open People, add or edit a person, set the role to Staff and choose their window.'],
  ],
};
