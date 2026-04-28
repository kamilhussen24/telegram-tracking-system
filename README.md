# Telegram Private Channel Join Tracker - Facebook CAPI

Production-ready system to track Telegram private channel join requests and send to Facebook for ad optimization.

## Features
✅ Server-Side Facebook CAPI Integration
✅ Duplicate Event Prevention
✅ Professional Logging System
✅ Mobile-First Beautiful Landing Page
✅ Private Channel Support - Manual Approval
✅ FB Policy Compliant
✅ Vercel KV Storage

## Setup Guide - Step by Step

### Step 1: Telegram Bot & Channel Setup

1. **Create Bot**:
   - Message @BotFather → `/newbot` → Follow steps
   - Copy the Bot Token

2. **Setup Private Channel**:
   - Create your private channel
   - Channel Settings → Administrators → Add Admin → Add your bot
   - Give Permission: `Invite Users via Link` - MUST HAVE
   - Channel Settings → Invite Links → Create Link
   - Enable `Request Admin Approval` - THIS IS KEY
   - Copy channel username without @

3. **Get Channel Username**:
   - Channel Info → Link: `t.me/your_channel` → Copy `your_channel`

### Step 2: Vercel Deployment

1. **Push to GitHub**:
   ```bash
   git init
   git add.
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main