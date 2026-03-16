# FirstBank PR Meeting -- Preparation Checklist

## 48 Hours Before
- [ ] Verify staging environment is running (app.cerniq.com or localhost:3001)
- [ ] Test `/pablo?mode=sales` loads correctly
- [ ] Test `/demo?preset=firstbank&mode=sales` loads with $12.8B profile
- [ ] Generate sample PDF report and save locally as backup
- [ ] Test bilingual toggle (EN / ES)
- [ ] Review FirstBank's latest annual report for talking points
- [ ] Confirm meeting logistics (room, screen sharing, Wi-Fi)
- [ ] Verify backend services are healthy (Node API + Go kit-service)

## 24 Hours Before
- [ ] Run full demo flow end-to-end (preset -> processing -> results -> PDF download)
- [ ] Download both EN and ES sample PDFs to local machine
- [ ] Prepare ROI talking points customized for FirstBank ($12.8B assets)
- [ ] Review demo script (docs/demo/PABLO_DEMO_SCRIPT.md)
- [ ] Charge laptop, test display adapter if presenting in-person

## Day Of
- [ ] Open browser, clear cache, navigate to demo URL
- [ ] Disable notifications (Do Not Disturb mode)
- [ ] Close all unnecessary tabs and applications
- [ ] Have backup PDF ready (USB drive or email draft)
- [ ] Print one copy of the Spanish report for physical leave-behind
- [ ] Have pricing one-pager ready (physical or email draft)
- [ ] Test internet connection at meeting location
- [ ] Open demo script on phone as presenter notes

## During Meeting
- [ ] Start with the problem (manual process pain) -- 3 minutes
- [ ] Run live demo (10 minutes max)
- [ ] Show ROI comparison -- use their scale ($12.8B) for impact
- [ ] Ask for pilot commitment
- [ ] Capture follow-up items using sales mode flags
- [ ] Note who is in the room and their roles
- [ ] Watch the clock -- do not exceed 20 minutes for the core presentation

## After Meeting (Same Day)
- [ ] Send follow-up email within 4 hours
- [ ] Attach: sample report (ES), pricing overview, ROI summary
- [ ] Include personalized note referencing something specific from the conversation
- [ ] Log meeting notes: attendees, questions asked, objections raised, interest level

## After Meeting (Within 1 Week)
- [ ] Schedule follow-up call within 5 business days
- [ ] If pilot agreed: send data upload instructions within 24 hours
- [ ] If undecided: send additional case study or testimonial material
- [ ] Update pipeline status in CRM
- [ ] Debrief internally on what worked and what to improve

## Emergency Fallback Plan
If the live demo fails during the meeting:
1. Switch to the pre-downloaded PDF report
2. Walk through it page by page as if it were the live output
3. Say: "Let me show you what the final deliverable looks like"
4. The PDF tells the same story -- duration gap, LCR, NII, compliance
5. Offer to run the live demo in a follow-up call
