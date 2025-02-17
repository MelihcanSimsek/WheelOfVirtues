import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import words from '../../../../shared/words.json';
import quotes from '../../../../shared/quates.json';


interface MoodOption {
  value: string;
  label: string;
  icon: string;
  color: string;
}

interface Word {
  id: number;
  name: string;
}

interface Quote {
  id: number;
  quotes: QuoteItem[];
}

interface QuoteItem {
  description: string;
  philosopher: string;
  philosopherImage: string;
}


@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  standalone: true
})
export class HomeComponent implements AfterViewInit {
  @ViewChild('wheelCanvas', { static: false }) wheelCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D | null;
  private rotationAngle: number = 0;
  private isDragging: boolean = false;
  private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private dragVelocity: number = 0;
  private lastDragTime: number = 0;
  private readonly FRICTION = 0.97;
  private readonly MIN_VELOCITY = 0.2;
  private readonly MAX_VELOCITY = 120;
  private readonly VELOCITY_MULTIPLIER = 4.0;
  private readonly MIN_ROTATIONS = 5;
  private animationFrameId: number | null = null;
  private SECTIONS = 10;
  private defaultImages: string[] = [
    'assets/day.jpg',
    'assets/night.jpg',
    'assets/winter.jpeg',
    'assets/door.jpeg',
  ];
  
  public showSpinMessage: boolean = true;
  public showMoodModal: boolean = true;
  public selectedMood: string | null = null;
  public showResultModal: boolean = false;
  public selectedWord: Word | null = null;
  public selectedQuote: QuoteItem | null = null;
  public selectedPhilosopherImage: string | null = null;
  public showSpinButton = true;
  private readonly SPIN_VELOCITY = 50;
  
  public readonly moodOptions: MoodOption[] = [
    { value: 'happy', label: 'Mutlu', icon: '😊', color: 'bg-yellow-400 hover:bg-yellow-500' },
    { value: 'sad', label: 'Üzgün', icon: '😢', color: 'bg-blue-400 hover:bg-blue-500' },
    { value: 'worried', label: 'Endişeli', icon: '😟', color: 'bg-purple-400 hover:bg-purple-500' },
    { value: 'stressed', label: 'Stresli', icon: '😰', color: 'bg-red-400 hover:bg-red-500' },
    { value: 'angry', label: 'Kızgın', icon: '😠', color: 'bg-orange-400 hover:bg-orange-500' },
    { value: 'tired', label: 'Yorgun', icon: '😴', color: 'bg-gray-400 hover:bg-gray-500' }
  ];

  public WORDS: Word[] = [];
  public QUOTES: Quote[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: Object,private titleService:Title) {
    this.titleService.setTitle('Wheel');
  }

  ngOnInit() {
    this.WORDS = words;
    this.QUOTES = quotes;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (!this.wheelCanvas) {
          console.error('Canvas element not found!');
          return;
        }
        this.SECTIONS = this.WORDS.length;
        this.ctx = this.wheelCanvas.nativeElement.getContext('2d');
        this.drawWheel();
      }, 100);
    }
  }

  ngAfterViewChecked() {
    if (isPlatformBrowser(this.platformId) && !this.ctx && this.wheelCanvas) {
      this.ctx = this.wheelCanvas.nativeElement.getContext('2d');
      this.drawWheel();
    }
  }

  onMouseDown(event: MouseEvent) {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.showSpinMessage = false;
    this.showSpinButton = false;
    this.isDragging = true;
    this.lastMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
    this.lastDragTime = performance.now();
    this.dragVelocity = 0;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!isPlatformBrowser(this.platformId) || !this.isDragging) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastDragTime;
    
    const rect = this.wheelCanvas.nativeElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const prevAngle = Math.atan2(
      this.lastMousePosition.y - centerY,
      this.lastMousePosition.x - centerX
    );
    const newAngle = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX
    );

    let angleDiff = (newAngle - prevAngle) * (180 / Math.PI);
    
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    if (deltaTime > 0) {
      const newVelocity = (angleDiff / deltaTime) * this.VELOCITY_MULTIPLIER;
      this.dragVelocity = this.dragVelocity * 0.8 + newVelocity * 0.2;
      this.dragVelocity = Math.max(Math.min(this.dragVelocity, this.MAX_VELOCITY), -this.MAX_VELOCITY);
    }

    this.rotationAngle += angleDiff;
    this.lastMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
    this.lastDragTime = currentTime;

    this.drawWheel();
  }

  onMouseUp() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (!this.isDragging) return;
    this.isDragging = false;
    
    if (Math.abs(this.dragVelocity) > this.MIN_VELOCITY) {
      if (Math.abs(this.dragVelocity) > this.MAX_VELOCITY / 2) {
        const direction = this.dragVelocity > 0 ? 1 : -1;
        this.dragVelocity = direction * (Math.abs(this.dragVelocity) + 360 * this.MIN_ROTATIONS);
      }
      this.spinWithMomentum();
    }
  }

  private spinWithMomentum() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.showSpinMessage = false;
    let lastTime = performance.now();
    let totalRotation = 0;
    
    const animate = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      const rotation = this.dragVelocity * (deltaTime / 16);
      this.rotationAngle += rotation;
      totalRotation += Math.abs(rotation);
      
      const currentFriction = totalRotation > 360 * this.MIN_ROTATIONS 
        ? this.FRICTION 
        : Math.max(this.FRICTION, 0.99);
      
      this.dragVelocity *= Math.pow(currentFriction, deltaTime / 16);
      this.drawWheel();

      if (Math.abs(this.dragVelocity) > this.MIN_VELOCITY) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.dragVelocity = 0;
        this.animationFrameId = null;
        this.showSpinMessage = true;
        this.handleSpinResult();
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  drawWheel() {
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    
    const ctx = this.ctx;
    const canvas = this.wheelCanvas.nativeElement;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 20;
    const sections = this.SECTIONS;
    const colors = [
      '#FF5733', '#33FF57', '#3357FF', '#F3FF33', 
      '#FF33A8', '#33FFF3', '#FF8333', '#33FF9E',
      '#9E33FF', '#FFE033'
    ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotationAngle * Math.PI / 180);

    for (let i = 0; i < sections; i++) {
      const angle = (i * 2 * Math.PI) / sections;
      const nextAngle = ((i + 1) * 2 * Math.PI) / sections;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, nextAngle);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      this.drawSectionText(ctx, i, radius, angle, nextAngle);
    }

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
    
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();

    if (this.showSpinMessage && !this.isDragging) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText('Spin the Wheel!', canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }

  private drawSectionText(
    ctx: CanvasRenderingContext2D,
    sectionIndex: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) {
    ctx.save();
    
    const middleAngle = startAngle + (endAngle - startAngle) / 2;
    
 
    const baseFontSize = Math.min(30, 34);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const words = this.WORDS[sectionIndex].name.split(' ');
    const startRadius = radius * 0.75;
    const textSpace = (radius * 0.4) / Math.max(words.length, 1);

    words.forEach((word, index) => {
      ctx.save();
      
      const textRadius = startRadius - (index * textSpace);
      
      let x = Math.cos(middleAngle) * textRadius;
      let y = Math.sin(middleAngle) * textRadius;

       ctx.translate(x, y);

      let fontSize = baseFontSize;
      
      ctx.font = `bold ${fontSize}px Arial`;

      let rotationAngle = middleAngle;
      
        rotationAngle += Math.PI;
      
      ctx.rotate(rotationAngle);
      
      ctx.fillText(word, 0, 0);
      
      ctx.restore();
    });
    
    ctx.restore();
  }
  

  private getSelectedSection(): number {
    let normalizedAngle = ((this.rotationAngle % 360) + 360) % 360;
    const sectionAngle = 360 / this.SECTIONS;
    
    const adjustedAngle = (360 - normalizedAngle + 180) % 360;
    
    const selectedSection = Math.floor(adjustedAngle / sectionAngle);
    
    return (selectedSection % this.SECTIONS) + 1;
  }

  public selectMood(mood: string) {
    this.selectedMood = mood;
    this.showMoodModal = false;
  }

  public closeResultModal() {
    this.showResultModal = false;
    this.selectedWord = null;
    this.selectedQuote = null;
    this.selectedPhilosopherImage = null;
  }

  private get fontSize(): number {
    const baseSize = Math.min(28, Math.max(16, 400 / this.SECTIONS));
    return baseSize;
  }

  getMoodAnimationClass(): string {
    switch (this.selectedMood) {
      case 'happy':
        return 'happy-animation';
      case 'sad':
        return 'sad-animation';
      case 'stressed':
        return 'stressed-animation';
      case 'worried':
        return 'sad-animation';
      case 'angry':
        return 'stressed-animation';
      case 'tired':
        return 'sad-animation';
      default:
        return '';
    }
  }

  private handleSpinResult() {
    const selectedIndex = this.getSelectedSection() - 1;
    if (selectedIndex >= 0) {
      this.selectedWord = this.WORDS[selectedIndex];
      if (this.QUOTES[selectedIndex]) {
        const randomQuoteIndex = Math.floor(Math.random() * this.QUOTES[selectedIndex].quotes.length);
        this.selectedQuote = this.QUOTES[selectedIndex].quotes[randomQuoteIndex];
        const imagePath = this.selectedQuote.philosopherImage.replace('../../../', '');
        const getImagePath = (imagePath: string): Promise<string> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.src = imagePath;
            img.onload = () => {
              resolve(imagePath);
            };
            img.onerror = () => {
              resolve(this.defaultImages[Math.floor(Math.random() * this.defaultImages.length)]);
            };
          });
        };

        getImagePath(imagePath).then((resolvedImagePath) => {
          this.selectedPhilosopherImage = resolvedImagePath;
          this.showResultModal = true;
        });
      }
    }
    
    setTimeout(() => {
      this.showSpinButton = true;
    }, 500);
  }

  public spinWheel() {
    if (this.isDragging || this.animationFrameId) return;
    
    this.showSpinButton = false;
    this.dragVelocity = this.SPIN_VELOCITY;
    this.spinWithMomentum();
  }

}
