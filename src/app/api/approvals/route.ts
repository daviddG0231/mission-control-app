import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Approval {
  id: string;
  title: string;
  description: string;
  agent: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  category: 'deploy' | 'send' | 'code' | 'config' | 'other';
}

const DATA_FILE = join(process.cwd(), 'data', 'approvals.json');

function readApprovalsData(): Approval[] {
  try {
    if (!existsSync(DATA_FILE)) {
      return [];
    }
    const data = readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data) || [];
  } catch (error) {
    console.error('Error reading approvals data:', error);
    return [];
  }
}

function writeApprovalsData(approvals: Approval[]): void {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(approvals, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing approvals data:', error);
    throw new Error('Failed to save approvals data');
  }
}

// GET - List all approvals
export async function GET() {
  try {
    const approvals = readApprovalsData();
    return NextResponse.json({ approvals });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

// POST - Add new approval or update status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const approvals = readApprovalsData();
    
    if (body.action === 'update_status' && body.id && body.status) {
      // Update existing approval status
      const approvalIndex = approvals.findIndex(a => a.id === body.id);
      if (approvalIndex === -1) {
        return NextResponse.json(
          { error: 'Approval not found' },
          { status: 404 }
        );
      }
      
      approvals[approvalIndex].status = body.status;
      writeApprovalsData(approvals);
      
      return NextResponse.json({ 
        success: true, 
        approval: approvals[approvalIndex] 
      });
    } else {
      // Add new approval
      const { title, description, agent, category } = body;
      
      if (!title || !description || !agent) {
        return NextResponse.json(
          { error: 'Missing required fields: title, description, agent' },
          { status: 400 }
        );
      }
      
      const newApproval: Approval = {
        id: Date.now().toString(),
        title,
        description,
        agent,
        status: 'pending',
        createdAt: new Date().toISOString(),
        category: category || 'other'
      };
      
      approvals.unshift(newApproval);
      writeApprovalsData(approvals);
      
      return NextResponse.json({ 
        success: true, 
        approval: newApproval 
      });
    }
  } catch (error) {
    console.error('Error processing approvals request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}