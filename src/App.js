import "./App.css";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import io from 'socket.io-client';
import MovieIcon from '@mui/icons-material/Movie';
import VideoPlayer from './components/VideoPlayer';
import LoginForm from './components/LoginForm';
import Portfolio from './components/Portfolio'; // Add Portfolio import
import { BoxGeometry, MeshBasicMaterial, CylinderGeometry } from 'three';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function Game() {
  const { roomId } = useParams();
  const canvasRef = useRef(null);
  const uiCanvasRef = useRef(null);
  const cutTreesRef = useRef(0); // cutTrees state'ini ref'e çevirdik
  const brokenRocksRef = useRef(0); // Yeni ref ekle
  const activeTreeRef = useRef(null);
  const lastButtonStateRef = useRef(false);
  const socketRef = useRef(null);
  const playersRef = useRef({});
  const [playerColor, setPlayerColor] = useState(null);
  const otherPlayersRef = useRef({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0000ff');
  const [showVideo, setShowVideo] = useState(false);
  const [activeVideoIcon, setActiveVideoIcon] = useState(null);
  const [showReward, setShowReward] = useState(false); // Yeni state ekle
  const rewardTimeoutRef = useRef(null); // Reward timeout için ref
  const activeRockRef = useRef(null); // Move ref to component level
  const [buildingPlaceholders, setBuildingPlaceholders] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const BUILDING_COSTS = {
    ROOM: { wood: 5, stone: 3 },
    ROOF: { wood: 3, stone: 1 }
  };

  const { t, language, toggleLanguage } = useLanguage();

  // Game constants
  const GAME_CONSTANTS = {
    skyRadius: 50,
    grassSize: 100,
    dayNightCycle: 8 * 60 * 1000, // 8 dakika (milisaniye cinsinden)
  };

  const [models, setModels] = useState({
    tree: null,
    rock: null,
    house: null
  });

  // Login formu komponenti
  const LoginForm = () => {
    const usernameRef = useRef();
    const colorRef = useRef();

    const handleSubmit = (e) => {
      e.preventDefault();
      if (username.trim()) {
        setIsLoggedIn(true);
      }
    };

    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        zIndex: 3
      }}>
        <h2>Oyuna Giriş</h2>
        <input
          ref={usernameRef}
          type="text"
          placeholder="Kullanıcı Adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ display: 'block', margin: '10px 0', padding: '5px', width: '200px' }}
        />
        <input
          ref={colorRef}
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          style={{ display: 'block', margin: '10px 0', width: '200px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!username.trim()}
          style={{ 
            padding: '8px 20px',
            width: '200px',
            cursor: username.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Oyuna Başla
        </button>
      </div>
    );
  };

  // Video iconları için pozisyonlar oluştur
  const createVideoIcons = () => {
    const icons = [];
    for(let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
      const z = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
      icons.push({
        position: new THREE.Vector3(x, 0.1, z),
        glowColor: new THREE.Color(0xffff00)
      });
    }
    return icons;
  };

  // Add handleCanvasClick at component level
  const handleCanvasClick = (event) => {
    const uiCanvas = uiCanvasRef.current;
    if (!uiCanvas) return;

    const rect = uiCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Reklam butonu tıklama kontrolü
    if (activeVideoIcon) {
      const buttonY = uiCanvas.height - 80;
      if (x > uiCanvas.width / 2 - 100 && 
          x < uiCanvas.width / 2 + 100 && 
          y > buttonY && 
          y < buttonY + 40) {
        setShowVideo(true);
        return;
      }
    }

    // Ağaç kesme butonu kontrolü
    if (activeTreeRef.current) {
      if (x > uiCanvas.width / 2 - 70 && 
          x < uiCanvas.width / 2 + 70 && 
          y > uiCanvas.height / 2 - 80 && 
          y < uiCanvas.height / 2 - 40) {
        // Access cutTree through ref
        if (window.cutTree) {
          window.cutTree(activeTreeRef.current);
        }
      }
    }

    // Reklam izleme butonu kontrolü
    if (activeVideoIcon) {
      if (x > uiCanvas.width / 2 - 100 && 
          x < uiCanvas.width / 2 + 100 && 
          y > uiCanvas.height / 2 - 30 && 
          y < uiCanvas.height / 2 + 10) {
        setShowVideo(true);
      }
    }

    // Taş kırma butonu kontrolü
    if (activeRockRef.current) {
      if (x > uiCanvas.width / 2 - 70 && 
          x < uiCanvas.width / 2 + 70 && 
          y > uiCanvas.height / 2 - 80 && 
          y < uiCanvas.height / 2 - 40) {
        breakRock(activeRockRef.current);
      }
    }
  };

  // Move breakRock function to component level
  const breakRock = (rock) => {
    if (!rock) return;
    const scene = window.gameScene; // We'll store scene reference
    if (!scene || !rock) return;
    scene.remove(rock.mesh);
    const rocks = window.gameRocks; // We'll store rocks reference
    if (rocks) {
      rocks.splice(rocks.indexOf(rock), 1);
    }
    brokenRocksRef.current += 1;
    activeRockRef.current = null;
    if (window.drawUI) {
      window.drawUI(lastButtonStateRef.current);
    }
  };

  const createBuildingPlaceholder = (x, z) => {
    const geometry = new THREE.BoxGeometry(4, 4, 4);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        canBuild: { value: 0 }, // 0: cannot build, 1: can build
        hovered: { value: 0 }   // 0: not hovered, 1: hovered
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float canBuild;
        uniform float hovered;
        varying vec2 vUv;
        void main() {
          float alpha = 0.3 + 0.2 * sin(time * 2.0);
          vec3 color = mix(vec3(0.0, 0.5, 1.0), vec3(0.0, 1.0, 0.0), canBuild);
          if (hovered > 0.5 && canBuild > 0.5) {
            color = vec3(0.0, 1.0, 0.3);
            alpha = 0.6;
          }
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true
    });

    const placeholder = new THREE.Mesh(geometry, material);
    placeholder.position.set(x, 2, z);
    
    // Preview house (initially invisible)
    const previewHouse = createHouseRoom(new THREE.Vector3(x, 2, z));
    previewHouse.visible = false;
    previewHouse.traverse(child => {
      if (child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.5;
      }
    });
    placeholder.add(previewHouse);

    // Malzeme gereksinimleri için metin
    const requirementCanvas = document.createElement('canvas');
    const ctx = requirementCanvas.getContext('2d');
    requirementCanvas.width = 512;  // Daha büyük canvas
    requirementCanvas.height = 256;
    
    const updateText = (canBuild) => {
      ctx.clearRect(0, 0, requirementCanvas.width, requirementCanvas.height);
      
      // Arka plan - roundRect yerine normal rect kullan
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, requirementCanvas.width, requirementCanvas.height);
      ctx.strokeStyle = canBuild ? '#00ff00' : '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, requirementCanvas.width - 4, requirementCanvas.height - 4);
      
      // Başlık
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = canBuild ? '#00ff00' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('Gerekli Malzemeler:', requirementCanvas.width/2, 60);
      
      // Mevcut/Gerekli malzeme sayıları
      ctx.font = 'bold 36px Arial';
      
      // Ağaç gereksinimleri
      const woodColor = cutTreesRef.current >= BUILDING_COSTS.ROOM.wood ? '#00ff00' : '#ff3333';
      ctx.fillStyle = woodColor;
      ctx.fillText(`${cutTreesRef.current}/${BUILDING_COSTS.ROOM.wood} Ağaç`, requirementCanvas.width/2, 120);
      
      // Taş gereksinimleri
      const stoneColor = brokenRocksRef.current >= BUILDING_COSTS.ROOM.stone ? '#00ff00' : '#ff3333';
      ctx.fillStyle = stoneColor;
      ctx.fillText(`${brokenRocksRef.current}/${BUILDING_COSTS.ROOM.stone} Taş`, requirementCanvas.width/2, 170);
      
      // Yapılabilirlik durumu
      if (canBuild) {
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText('✓ İnşa edilebilir!', requirementCanvas.width/2, 220);
      } else {
        ctx.font = 'bold 32px Arial';
        ctx.fillText('❌ Yeterli malzeme yok!', requirementCanvas.width/2, 220);
      }
    };

    const requirementTexture = new THREE.CanvasTexture(requirementCanvas);
    requirementTexture.needsUpdate = true;
    const requirementMaterial = new THREE.SpriteMaterial({
      map: requirementTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const requirementSprite = new THREE.Sprite(requirementMaterial);
    requirementSprite.position.set(0, 6, 0); // Daha yukarıda
    requirementSprite.scale.set(8, 4, 1);    // Daha büyük
    placeholder.add(requirementSprite);

    // Billboard effect - her zaman kameraya bak
    const lookAtCamera = () => {
      if (window.gameCamera) {
        requirementSprite.lookAt(window.gameCamera.position);
      }
    };
    
    placeholder.updateStatus = (canBuild) => {
      material.uniforms.canBuild.value = canBuild ? 1 : 0;
      updateText(canBuild);
      requirementTexture.needsUpdate = true;
      lookAtCamera();
    };

    return placeholder;
  };

  const createHouseRoom = (position) => {
    const room = new THREE.Group();

    // Ana oda
    const wallsGeometry = new THREE.BoxGeometry(4, 4, 4);
    const wallsMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const walls = new THREE.Mesh(wallsGeometry, wallsMaterial);

    // Kapı
    const doorGeometry = new THREE.BoxGeometry(1, 2, 0.1);
    const doorMaterial = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, -1, 2); // Ön duvarda

    // Pencere
    const windowGeometry = new THREE.BoxGeometry(1, 1, 0.1);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb });
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(-1.5, 0, 2); // Ön duvarda

    // Çatı
    const roofGeometry = new THREE.CylinderGeometry(0, 2.5, 2, 4);
    const roofMaterial = new THREE.MeshBasicMaterial({ color: 0x8b0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.y = Math.PI / 4; // 45 derece döndür
    roof.position.y = 3; // Odanın üstüne yerleştir

    room.add(walls, door, window, roof);
    room.position.copy(position);

    return room;
  };

  const tryToBuild = (placeholder) => {
    if (cutTreesRef.current >= BUILDING_COSTS.ROOM.wood && 
        brokenRocksRef.current >= BUILDING_COSTS.ROOM.stone) {
      
      // Malzemeleri kullan
      cutTreesRef.current -= BUILDING_COSTS.ROOM.wood;
      brokenRocksRef.current -= BUILDING_COSTS.ROOM.stone;

      // Place holder'ı kaldır
      const scene = window.gameScene;
      scene.remove(placeholder);
      setBuildingPlaceholders(prev => prev.filter(p => p !== placeholder));

      // Evi oluştur
      const house = createHouseRoom(placeholder.position);
      scene.add(house);
      setBuildings(prev => [...prev, house]);
    }
  };

  // Move createChild function outside of initGame and make it a component method
  const createChild = useCallback((color, name) => {
    const childGroup = new THREE.Group();
    
    // Baş her oyuncu için aynı
    const headGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.5, 0);
    childGroup.add(head);

    // Gövde rengi her oyuncu için farklı
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1, 16);
    const bodyMaterial = new THREE.MeshBasicMaterial({ 
      color: typeof color === 'string' ? parseInt(color.replace('#', '0x')) : color 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.5, 0);
    childGroup.add(body);

    // İsim etiketi
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Arka plan ekle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // İsmi yaz
    ctx.fillStyle = 'white';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width/2, canvas.height/2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const nameMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const nameSprite = new THREE.Sprite(nameMaterial);
    nameSprite.position.set(0, 2.5, 0);
    nameSprite.scale.set(2, 0.5, 1);
    childGroup.add(nameSprite);

    return childGroup;
  }, []);

  // Add createAndAddPlayer function before useEffect
  const createAndAddPlayer = useCallback((playerInfo) => {
    const newPlayer = createChild(playerInfo.color, playerInfo.username);
    newPlayer.position.set(playerInfo.x, 0, playerInfo.z);
    window.gameScene.add(newPlayer);
    otherPlayersRef.current[playerInfo.id] = newPlayer;
  }, [createChild]);

  // Add handleMouseMove function before useEffect
  const handleMouseMove = useCallback((event, camera, raycaster) => {
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    buildingPlaceholders.forEach(placeholder => {
      if (placeholder.showPreview) {
        const previewHouse = placeholder.children[0];
        previewHouse.visible = false;
      }
    });
    
    const intersects = raycaster.intersectObjects(buildingPlaceholders);
    if (intersects.length > 0) {
      const placeholder = intersects[0].object;
      const previewHouse = placeholder.children[0];
      const canBuild = cutTreesRef.current >= BUILDING_COSTS.ROOM.wood && 
                       brokenRocksRef.current >= BUILDING_COSTS.ROOM.stone;
      previewHouse.visible = true;
      placeholder.material.uniforms.hovered.value = canBuild ? 1 : 0;
    }
  }, [buildingPlaceholders, BUILDING_COSTS.ROOM.wood, BUILDING_COSTS.ROOM.stone]);

  const loadModels = useCallback(async () => {
    const loader = new GLTFLoader();
    console.log('Starting to load models...');
    
    try {
      // Set fallbacks first
      const fallbackTree = createFallbackTree();
      const fallbackRock = createFallbackRock();
      setModels({
        tree: fallbackTree,
        rock: fallbackRock
      });

      // Try to load models
      loader.load('/models/tree.glb', 
        (gltf) => {
          console.log('Tree model loaded successfully:', gltf);
          setModels(prev => ({
            ...prev,
            tree: gltf.scene
          }));
        },
        (progress) => {
          console.log('Loading tree model:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Error loading tree model:', error);
        }
      );

      loader.load('/models/rock.glb',
        (gltf) => {
          console.log('Rock model loaded successfully:', gltf);
          setModels(prev => ({
            ...prev,
            rock: gltf.scene
          }));
        },
        (progress) => {
          console.log('Loading rock model:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Error loading rock model:', error);
        }
      );

    } catch (error) {
      console.error('Error in loadModels:', error);
    }
  }, []);

  // Add fallback creation functions
  const createFallbackTree = () => {
    const group = new THREE.Group();
    
    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3, 8),
      new THREE.MeshBasicMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 1.5;
    
    // Leaves
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x228B22 })
    );
    leaves.position.y = 3;
    
    group.add(trunk, leaves);
    return group;
  };

  const createFallbackRock = () => {
    return new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x808080 })
    );
  };

  useEffect(() => {
    // Load models first
    loadModels().then(() => {
      console.log('Models loaded, starting game...');
      // Rest of game initialization
      if (!isLoggedIn) {
        // Check for stored user data
        const storedData = localStorage.getItem('gameUserData');
        if (storedData) {
          const { username: storedUsername, selectedColor: storedColor } = JSON.parse(storedData);
          setUsername(storedUsername);
          setSelectedColor(storedColor);
          setIsLoggedIn(true);
          
          // Clean up stored data
          localStorage.removeItem('gameUserData');
        }
        return;
      }
  
      // Update socket connection to use secure WebSocket
      socketRef.current = io(process.env.REACT_APP_SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        secure: true,
        rejectUnauthorized: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true
      });
  
      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        // Attempt to reconnect with polling if websocket fails
        if (socketRef.current.io.opts.transports[0] === 'websocket') {
          socketRef.current.io.opts.transports = ['polling', 'websocket'];
        }
      });
  
      // Oda katılım olayı
      socketRef.current.emit('joinRoom', {
        roomId,
        isRandom: !roomId,
        playerData: {
          username,
          color: selectedColor
        }
      });
  
      // Odaya katılım başarılı olduğunda
      socketRef.current.on('roomJoined', ({ roomData, currentPlayers }) => {
        initGame(roomData);
        
        // Mevcut diğer oyuncuları ekle
        Object.entries(currentPlayers).forEach(([playerId, playerInfo]) => {
          if (playerId !== socketRef.current.id) {
            createAndAddPlayer(playerInfo);
          }
        });
      });
  
      // Cleanup
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    });
  }, [isLoggedIn, roomId, username, selectedColor, createAndAddPlayer, loadModels]);

  // Oyun başlatma işlemleri
  const initGame = useCallback((roomData) => {
    const canvas = canvasRef.current;
    const uiCanvas = uiCanvasRef.current;
    if (!canvas || !uiCanvas) return;

    const drawUI = (showButton) => {
      const ctx = uiCanvas.getContext("2d");
      if (!ctx) return;
      // UI'yi temizle
      ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
      // Envanter paneli
      ctx.save();
      // Brown gradient instead of wood texture
      const gradient = ctx.createLinearGradient(20, 20, 20, 170);
      gradient.addColorStop(0, '#5d4037');
      gradient.addColorStop(1, '#3e2723');
      ctx.fillStyle = gradient;
      createWoodenPanel(ctx, 20, 20, 280, 150);
      // Envanter başlığı
      ctx.font = "30px 'Permanent Marker'";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 5;
      ctx.fillText(t("inventory"), 160, 60);
      // Envanter içeriği
      ctx.font = "24px 'Indie Flower'";
      ctx.textAlign = "left";
      ctx.fillText(`🌳 ${t("wood")}: ${cutTreesRef.current}`, 40, 100);
      ctx.fillText(`🪨 ${t("stone")}: ${brokenRocksRef.current}`, 40, 130);
      ctx.restore();
      // Etkileşim butonları
      if (showButton) {
        createWoodenButton(ctx, t("cutTree"), uiCanvas.width / 2 - 70, uiCanvas.height / 2 - 80);
      }
      if (activeRockRef.current) {
        createWoodenButton(ctx, t("breakRock"), uiCanvas.width / 2 - 70, uiCanvas.height / 2 - 30);
      }
    };

    const createWoodenPanel = (ctx, x, y, width, height) => {
      ctx.save();
      // Panel gölgesi
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      // Panel arka planı - gradient
      const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
      gradient.addColorStop(0, '#5d4037');
      gradient.addColorStop(1, '#3e2723');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
      // Panel kenarlığı
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 8;
      ctx.strokeRect(x + 4, y + 4, width - 8, height - 8);
      // İç gölge efekti
      const innerShadow = ctx.createLinearGradient(x, y, x, y + height);
      innerShadow.addColorStop(0, 'rgba(0,0,0,0.2)');
      innerShadow.addColorStop(0.5, 'rgba(0,0,0,0)');
      innerShadow.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = innerShadow;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
    };

    const createWoodenButton = (ctx, text, x, y) => {
      ctx.save();
      // Button gölgesi
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      const buttonWidth = 140;
      const buttonHeight = 40;
      const radius = 8;
      // Button arka planı - gradient
      const gradient = ctx.createLinearGradient(x, y, x + buttonWidth, y + buttonHeight);
      gradient.addColorStop(0, '#5d4037');
      gradient.addColorStop(1, '#3e2723');
      ctx.fillStyle = gradient;
      // Yuvarlak köşeli buton çizimi
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + buttonWidth - radius, y);
      ctx.quadraticCurveTo(x + buttonWidth, y, x + buttonWidth, y + radius);
      ctx.lineTo(x + buttonWidth, y + buttonHeight - radius);
      ctx.quadraticCurveTo(x + buttonWidth, y + buttonHeight, x + buttonWidth - radius, y + buttonHeight);
      ctx.lineTo(x + radius, y + buttonHeight);
      ctx.quadraticCurveTo(x, y + buttonHeight, x, y + buttonHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();
      // İç gölge efekti
      const innerShadow = ctx.createLinearGradient(x, y, x, y + buttonHeight);
      innerShadow.addColorStop(0, 'rgba(0,0,0,0.2)');
      innerShadow.addColorStop(0.5, 'rgba(0,0,0,0)');
      innerShadow.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = innerShadow;
      ctx.fill();
      // Button text
      ctx.font = "20px 'Permanent Marker'";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 2;
      ctx.fillText(text, x + buttonWidth / 2, y + buttonHeight / 2);
      ctx.restore();
    };

    // Store UI drawing function globally right after declaration
    window.drawUI = drawUI;

    // Socket.io bağlantısı
    socketRef.current = io('wss://catupet-server.onrender.com', {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    // Oyuncu bilgilerini gönder
    socketRef.current.emit('playerInit', {
      username,
      color: selectedColor
    });

    // Canvas boyutlarını ayarla
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    uiCanvas.width = window.innerWidth;
    uiCanvas.height = window.innerHeight;

    const scene = new THREE.Scene();
    window.gameScene = scene; // Store scene reference globally
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      alpha: true // Saydam arka plan için
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Add raycaster initialization
    const raycaster = new THREE.Raycaster();

    // 🌌 GÖKYÜZÜ VE ZAMAN SİSTEMİ
    const skyGeometry = new THREE.SphereGeometry(GAME_CONSTANTS.skyRadius, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({ 
      side: THREE.BackSide, 
      vertexColors: true 
    });

    // Gök kubbe renkleri
    const dayColor = new THREE.Color(0x87CEEB);  // Açık mavi
    const nightColor = new THREE.Color(0x1a2b4c); // Koyu mavi
    
    const vertices = skyGeometry.getAttribute('position');
    const colors = [];

    for (let i = 0; i < vertices.count; i++) {
      colors.push(dayColor.r, dayColor.g, dayColor.b);
    }

    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Güneş ve Ay oluştur
    // Güneş için parlaklık halkası
    const sunGlowGeometry = new THREE.RingGeometry(2.2, 4, 32);
    const sunGlowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xffff00) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          float alpha = 0.5 * (1.0 + sin(time * 2.0)) * (1.0 - abs(vUv.x - 0.5));
          gl_FragColor = vec4(color, alpha * 0.5);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    
    // Güneş ana küresi
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec3 sunColor = vec3(1.0, 0.95, 0.4);
          float brightness = 0.8 + 0.2 * sin(time * 3.0);
          gl_FragColor = vec4(sunColor * brightness, 1.0);
        }
      `
    });
    const sun = new THREE.Group();
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.add(sunMesh);
    sun.add(sunGlow);
    scene.add(sun);

    // Ay için parlaklık halkası
    const moonGlowGeometry = new THREE.RingGeometry(1.7, 3, 32);
    const moonGlowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0xaaaaff) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          float alpha = 0.3 * (1.0 + sin(time * 1.5)) * (1.0 - abs(vUv.x - 0.5));
          gl_FragColor = vec4(color, alpha * 0.3);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });
    const moonGlow = new THREE.Mesh(moonGlowGeometry, moonGlowMaterial);

    // Ay ana küresi
    const moonGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const moonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec3 moonColor = vec3(0.9, 0.9, 1.0);
          float brightness = 0.7 + 0.3 * sin(time * 2.0);
          gl_FragColor = vec4(moonColor * brightness, 1.0);
        }
      `
    });
    const moon = new THREE.Group();
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.add(moonMesh);
    moon.add(moonGlow);
    scene.add(moon);

    // Gün/Gece döngüsü için başlangıç zamanı
    const startTime = Date.now();

    // Güneş ve ay pozisyonlarını güncelle
    const updateDayNightCycle = () => {
      const time = Date.now() - startTime;
      const cycleProgress = (time % (GAME_CONSTANTS.dayNightCycle * 2)) / (GAME_CONSTANTS.dayNightCycle * 2);
      const angle = cycleProgress * Math.PI * 2;

      // Güneş pozisyonu
      sun.position.x = Math.cos(angle) * GAME_CONSTANTS.skyRadius * 0.8;
      sun.position.y = Math.sin(angle) * GAME_CONSTANTS.skyRadius * 0.8;
      sun.position.z = 0;
      
      // Güneş shader'ını güncelle
      sunMaterial.uniforms.time.value = time * 0.001;
      sunGlowMaterial.uniforms.time.value = time * 0.001;

      // Ay pozisyonu
      moon.position.x = Math.cos(angle + Math.PI) * GAME_CONSTANTS.skyRadius * 0.8;
      moon.position.y = Math.sin(angle + Math.PI) * GAME_CONSTANTS.skyRadius * 0.8;
      moon.position.z = 0;

      // Ay shader'ını güncelle
      moonMaterial.uniforms.time.value = time * 0.001;
      moonGlowMaterial.uniforms.time.value = time * 0.001;

      // Gökyüzü rengini güncelle
      const dayWeight = (Math.sin(angle) + 1) / 2;
      const colors = skyGeometry.getAttribute('color');

      for (let i = 0; i < colors.count; i++) {
        const color = new THREE.Color().lerpColors(nightColor, dayColor, dayWeight);
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;

      // Işık yoğunluğunu güncelle - güvenli şekilde
      const ambientIntensity = 0.3 + dayWeight * 0.7;
      scene.traverse((child) => {
        if (child.material && !(child === sun || child === moon)) {
          // Eğer originalColor yoksa, mevcut rengi sakla
          if (!child.material.userData.originalColor) {
            if (child.material.color) {
              child.material.userData.originalColor = child.material.color.clone();
            } else {
              // Eğer material.color yoksa, varsayılan beyaz renk kullan
              child.material.userData.originalColor = new THREE.Color(1, 1, 1);
            }
          }
          
          if (child.material.color && child.material.userData.originalColor) {
            child.material.color.copy(child.material.userData.originalColor).multiplyScalar(ambientIntensity);
          }
        }
      });
    };

    // 🍀 ÇİM (DÜZLEM)
    const grassSize = 100;
    const grassGeometry = new THREE.PlaneGeometry(grassSize, grassSize);
    const grassMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22 });

    // 3x3 çimen alanı oluştur
    const grasses = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(i * grassSize, 0, j * grassSize);
        scene.add(grass);
        grasses.push(grass);
      }
    }

    // 🌳 AĞAÇLAR (Rastgele Yerleştirme)
    const trees = [];
    function createTree(x, z) {
      if (!models.tree) {
        console.warn('Tree model not available');
        return;
      }
      
      const tree = models.tree.clone();
      // Ensure the tree is visible and properly positioned
      tree.visible = true;
      tree.position.set(x, 0, z);
      tree.scale.set(0.5, 0.5, 0.5);
      
      // Debug log
      console.log('Created tree at:', { x, z }, tree);
      
      scene.add(tree);
      trees.push({ mesh: tree, x, z });
    }

    // 🎲 20 AĞAÇ RASTGELE KONUMA EKLE
    for (let i = 0; i < 20; i++) {
      let x, z, distanceFromCenter;

      do {
        x = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
        z = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
        distanceFromCenter = Math.sqrt(x * x + z * z);
      } while (distanceFromCenter > GAME_CONSTANTS.skyRadius - 2 || (Math.abs(x) < 5 && Math.abs(z) < 5)); // Çocuk doğduğu yerde olmasın

      createTree(x, z);
    }

    // 🪨 TAŞLAR (Rastgele Yerleştirme)
    const rocks = [];
    window.gameRocks = rocks; // Store rocks reference globally
    function createRock(x, z) {
      if (!models.rock) {
        console.warn('Rock model not available');
        return;
      }
      
      const rock = models.rock.clone();
      // Ensure the rock is visible and properly positioned
      rock.visible = true;
      rock.position.set(x, 0, z);
      rock.scale.set(0.3, 0.3, 0.3);
      
      // Debug log
      console.log('Created rock at:', { x, z }, rock);
      
      scene.add(rock);
      rocks.push({ mesh: rock, x, z });
    }

    // 15 TAŞ RASTGELE KONUMA EKLE
    for (let i = 0; i < 15; i++) {
      let x, z, distanceFromCenter;
      do {
        x = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
        z = (Math.random() - 0.5) * (GAME_CONSTANTS.skyRadius * 2 - 10);
        distanceFromCenter = Math.sqrt(x * x + z * z);
      } while (distanceFromCenter > GAME_CONSTANTS.skyRadius - 2);
      createRock(x, z);
    }

    // 🍃 BULUTLAR
    function createCloud() {
      const cloudGeometry = new THREE.PlaneGeometry(4, 2); // Rectangular cloud
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);

      // Randomize position within the sky (only in the upper part of the sky)
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * (GAME_CONSTANTS.skyRadius - 2); // Clouds will be positioned just in front of the sky sphere
      const height = Math.random() * 10 + 10; // Random height above the ground (between 15 and 45)

      cloud.position.set(
        Math.cos(angle) * distance,
        height, // Set cloud's height to be higher in the sky
        Math.sin(angle) * distance
      );

      // Randomize cloud size
      const scale = 1 + Math.random() * 2; // Scale from 1x to 3x size
      cloud.scale.set(scale, scale, scale);

      scene.add(cloud);
    }

    // 🍃 20 BULUT EKLE
    for (let i = 0; i < 20; i++) {
      createCloud();
    }

    // Ana oyuncuyu oluştur ve global referansa kaydet
    const mainPlayer = createChild(selectedColor, username);
    mainPlayer.position.set(2, 0, 0);
    scene.add(mainPlayer);
    window.mainPlayer = mainPlayer;

    // Socket olaylarını dinle
    socketRef.current.on('newPlayer', (playerInfo) => {
      // Eğer oyuncu zaten varsa, güncelle
      if (otherPlayersRef.current[playerInfo.id]) {
        scene.remove(otherPlayersRef.current[playerInfo.id]);
      }
      
      const otherPlayer = createChild(playerInfo.color, playerInfo.username);
      otherPlayer.position.set(playerInfo.x, 0, playerInfo.z);
      scene.add(otherPlayer);
      otherPlayersRef.current[playerInfo.id] = otherPlayer;
    });

    socketRef.current.on('playerMoved', (playerInfo) => {
      const existingPlayer = otherPlayersRef.current[playerInfo.id];
      if (existingPlayer) {
        existingPlayer.position.x = playerInfo.x;
        existingPlayer.position.z = playerInfo.z;
      }
    });

    socketRef.current.on('playerDisconnected', (playerId) => {
      if (otherPlayersRef.current[playerId]) {
        scene.remove(otherPlayersRef.current[playerId]);
        delete otherPlayersRef.current[playerId];
      }
    });

    // 📌 KAMERA BAŞLANGIÇ POZİSYONU
    camera.position.set(0, 5, 10);
    camera.lookAt(mainPlayer.position);

    // Ağaç kesme fonksiyonunu güncelle
    const cutTree = (tree) => {
      if (!tree) return;
      scene.remove(tree.trunk);
      scene.remove(tree.leaves);
      trees.splice(trees.indexOf(tree), 1);
      cutTreesRef.current += 1; // State yerine ref kullan
      activeTreeRef.current = null;
    };

    // Store cutTree function globally for access from click handler
    window.cutTree = cutTree;

    // Store UI drawing function globally
    window.drawUI = drawUI;

    // Store moveChild function globally
    window.moveChild = moveChild;
    
    // Taş yakınlık kontrolü
    function checkRockProximity() {
      let closestRock = null;
      let minDistance = Infinity;

      rocks.forEach(rock => {
        const distance = Math.sqrt(
          Math.pow(mainPlayer.position.x - rock.x, 2) + 
          Math.pow(mainPlayer.position.z - rock.z, 2)
        );
        if (distance < 3 && distance < minDistance) {
          minDistance = distance;
          closestRock = rock;
        }
      });

      if (closestRock !== activeRockRef.current) {
        activeRockRef.current = closestRock;
        drawUI(lastButtonStateRef.current);
      }
    }

    // Zıplama değişkenleri
    const jumpState = {
      isJumping: false,
      velocity: 0,
      initialY: 0,
      gravity: 0.015,
      jumpForce: 0.4,  // Normal zıplama kuvveti
      maxHeight: 1.5,  // Maksimum zıplama yüksekliği
      nearRock: false  // Taşa yakın olma durumu
    };

    // 🎮 ÇOCUK HAREKETİ VE SINIRLAR
    function moveChild(event) {
      const mainPlayer = window.mainPlayer; // Global referanstan al
      if (!mainPlayer) return;

      const speed = 1;
      let newX = mainPlayer.position.x;
      let newZ = mainPlayer.position.z;

      // Zıplama kontrolü
      if (event.code === "Space" && !jumpState.isJumping) {
        jumpState.isJumping = true;
        jumpState.velocity = jumpState.jumpForce;
        jumpState.initialY = mainPlayer.position.y;
        
        // Eğer taşa yakınsa ve yön tuşlarından biri basılıysa daha yükseğe zıpla
        if (jumpState.nearRock && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some(
          key => event.key === key)) {
          jumpState.velocity = jumpState.jumpForce * 1.5; // 1.5 kat daha yükseğe zıpla
        }
      }

      // Yeni pozisyonu hesapla
      if (event.key === "ArrowUp") newZ -= speed;
      if (event.key === "ArrowDown") newZ += speed;
      if (event.key === "ArrowLeft") newX -= speed;
      if (event.key === "ArrowRight") newX += speed;

      // Harita sınır kontrolü
      const distanceFromCenter = Math.sqrt(newX * newX + newZ * newZ);
      if (distanceFromCenter >= GAME_CONSTANTS.skyRadius - 1) {
        return; // Sınırları aşıyorsa hiç hareket etme
      }

      // Taş yakınlık kontrolü ve çarpışma kontrolü
      let hasCollision = false;
      jumpState.nearRock = false; // Her frame'de reset

      // Ağaç çarpışma kontrolü
      trees.forEach(tree => {
        const dx = newX - tree.x;
        const dz = newZ - tree.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < 2.5) {
          hasCollision = true;
        }
      });

      // Taş çarpışma kontrolü
      rocks.forEach(rock => {
        const dx = newX - rock.x;
        const dz = newZ - rock.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 2) {
          jumpState.nearRock = true; // Taşa yakın olduğunu işaretle
          
          // Eğer yeterince yüksekte değilse çarpışma var
          if (mainPlayer.position.y < jumpState.maxHeight) {
            hasCollision = true;
          }
        }
      });

      // Sadece çarpışma yoksa hareket et
      if (!hasCollision) {
        mainPlayer.position.x = newX;
        mainPlayer.position.z = newZ;
        sendPlayerUpdate(newX, newZ);
      }

      // C tuşu ile ağaç kesme
      if (event.key === "c" || event.key === "C") {
        cutTree(activeTreeRef.current);
      }

      // X tuşu ile taş kırma
      if (event.key === "x" || event.key === "X") {
        breakRock(activeRockRef.current);
      }
    }

    window.addEventListener("keydown", moveChild);

    // 📌 ÇOCUK AĞAÇLARA YAKLAŞTIĞINDA BUTON GÖRÜNÜR
    const showCutButton = () => {
      let buttonVisible = false;
      let closestTree = null;
      let minDistance = Infinity;

      trees.forEach(tree => {
        const distance = Math.sqrt(
          Math.pow(mainPlayer.position.x - tree.x, 2) + 
          Math.pow(mainPlayer.position.z - tree.z, 2)
        );
        if (distance < 5 && distance < minDistance) {
          minDistance = distance;
          closestTree = tree;
          buttonVisible = true;
        }
      });

      // State değişikliğini ref ile yapıyoruz
      if (buttonVisible !== lastButtonStateRef.current) {
        lastButtonStateRef.current = buttonVisible;
        activeTreeRef.current = buttonVisible ? closestTree : null;
        drawUI(buttonVisible);
      }
    };

    // Video iconları oluştur
    const videoIcons = createVideoIcons();
    const intervals = []; // Store interval references

    videoIcons.forEach(icon => {
      // Icon mesh
      const iconGeometry = new THREE.PlaneGeometry(1.5, 1.5); // Biraz daha büyük icon
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 64;
      iconCanvas.height = 64;
      const ctx = iconCanvas.getContext('2d');
      
      // Video icon tasarımı
      const drawVideoIcon = () => {
        ctx.clearRect(0, 0, 64, 64);
        const pulseValue = (Math.sin(Date.now() * 0.005) + 1) / 2;
        
        // Gradient arka plan
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, `rgba(255, 64, 129, ${0.8 + pulseValue * 0.2})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, ${0.5 + pulseValue * 0.2})`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();

        // Play simgesi
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(24, 20);
        ctx.lineTo(44, 32);
        ctx.lineTo(24, 44);
        ctx.closePath();
        ctx.fill();
      };
      
      drawVideoIcon();
      
      const iconTexture = new THREE.CanvasTexture(iconCanvas);
      const iconMaterial = new THREE.MeshBasicMaterial({
        map: iconTexture,
        transparent: true,
        side: THREE.DoubleSide
      });
      const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
      iconMesh.position.copy(icon.position);
      iconMesh.position.y = 0.1; // Yerden biraz yukarıda
      iconMesh.rotation.x = -Math.PI / 2;
      scene.add(iconMesh);

      // Video icon animasyonu ve collision kontrolü
      const interval = setInterval(() => {
        if (!mainPlayer) return;
        
        // Icon'u güncelle
        drawVideoIcon();
        iconTexture.needsUpdate = true;
        
        // Mesafe kontrolü
        const distance = mainPlayer.position.distanceTo(icon.position);
        if (distance < 1.5 && !showVideo) { // Mesafeyi ve video durumunu kontrol et
          setShowVideo(true);
          setActiveVideoIcon(icon);
        }
      }, 50);

      intervals.push(interval);
    });

    // Place holder'ları oluştur
    const placeholder1 = createBuildingPlaceholder(-10, -10);
    const placeholder2 = createBuildingPlaceholder(10, 10);
    scene.add(placeholder1, placeholder2);
    setBuildingPlaceholders([placeholder1, placeholder2]);

    // Place holder'a tıklama kontrolü
    const handlePlaceholderClick = (event, camera, raycaster) => {
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(buildingPlaceholders);
      
      if (intersects.length > 0) {
        const placeholder = intersects[0].object;
        if (cutTreesRef.current >= BUILDING_COSTS.ROOM.wood && 
            brokenRocksRef.current >= BUILDING_COSTS.ROOM.stone) {
          tryToBuild(placeholder);
        }
      }
    };

    // Remove duplicate socket event handlers and keep only the ones in useEffect
    window.addEventListener('click', (event) => handlePlaceholderClick(event, camera, raycaster));
    window.addEventListener('mousemove', (event) => handleMouseMove(event, camera, raycaster));

    // Hareket sırasında tüm bilgileri gönder
    const sendPlayerUpdate = (newX, newZ) => {
      socketRef.current.emit('playerMove', {
        x: newX,
        z: newZ,
        username: username,
        color: selectedColor
      });
    };

    // Add floating pyramid
    const createFloatingPyramid = () => {
      const geometry = new THREE.ConeGeometry(2, 4, 4);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0xffff00) },
          color2: { value: new THREE.Color(0xff0000) }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform vec3 color1;
          uniform vec3 color2;
          varying vec2 vUv;
          void main() {
            vec3 color = mix(color1, color2, sin(time * 2.0) * 0.5 + 0.5);
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });

      const pyramid = new THREE.Mesh(geometry, material);
      pyramid.position.set(0, 5, -10); // Position above ground
      pyramid.userData.isPortalPyramid = true;
      scene.add(pyramid);

      const animate = () => {
        pyramid.position.y = 5 + Math.sin(Date.now() * 0.001) * 0.5;
        pyramid.rotation.y += 0.01;
        material.uniforms.time.value = Date.now() * 0.001;
      };

      return { mesh: pyramid, animate };
    };

    const pyramid = createFloatingPyramid();

    // 🎥 ANİMASYON DÖNGÜSÜ
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);

      updateDayNightCycle();

      // Update floating pyramid
      pyramid.animate();

      // Check for collision with pyramid
      if (mainPlayer) {
        const pyramidPosition = pyramid.mesh.position;
        const playerPosition = mainPlayer.position;
        const distance = playerPosition.distanceTo(pyramidPosition);

        if (distance < 2 && playerPosition.y > pyramidPosition.y - 2) {
          // Player touched the pyramid while jumping
          if (username) {
            window.location.href = `/${roomId}/${username}`;
          }
        }
      }

      // Zıplama animasyonu
      if (jumpState.isJumping) {
        mainPlayer.position.y += jumpState.velocity;
        jumpState.velocity -= jumpState.gravity;

        // Yere inme kontrolü
        if (mainPlayer.position.y <= jumpState.initialY) {
          mainPlayer.position.y = jumpState.initialY;
          jumpState.isJumping = false;
          jumpState.velocity = 0;
        }
      }

      // Kamera pozisyonunu yumuşak geçişle güncelle
      const targetX = mainPlayer.position.x;
      const targetZ = mainPlayer.position.z + 10;
      
      camera.position.x += (targetX - camera.position.x) * 0.1;
      camera.position.z += (targetZ - camera.position.z) * 0.1;
      camera.lookAt(mainPlayer.position);

      const time = clock.getElapsedTime();
      scene.children.forEach(child => {
        if (child.material && child.material.uniforms && child.material.uniforms.time) {
          child.material.uniforms.time.value = time;
        }
      });

      // Update placeholders status
      buildingPlaceholders.forEach(placeholder => {
        const canBuild = cutTreesRef.current >= BUILDING_COSTS.ROOM.wood && 
                         brokenRocksRef.current >= BUILDING_COSTS.ROOM.stone;
        placeholder.updateStatus(canBuild);
      });

      renderer.render(scene, camera);
      showCutButton();
      checkRockProximity(); // Rock proximity check in animation loop
    }

    animate();

    // Pencere boyutu değiştiğinde güncelle
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width;
      canvas.height = height;
      uiCanvas.width = width;
      uiCanvas.height = height;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener('resize', handleResize);

    // Animate function içine ekle (camera tanımlandıktan sonra):
    window.gameCamera = camera;

    return () => {
      // Clear all intervals
      intervals.forEach(interval => clearInterval(interval));
      
      // Temizleme işlemlerinde interval'i de temizle
      window.removeEventListener("keydown", moveChild);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handlePlaceholderClick);
      window.removeEventListener('mousemove', handleMouseMove);
      delete window.cutTree; // Clean up global reference
      delete window.gameScene;
      delete window.gameRocks;
      delete window.drawUI;
      delete window.moveChild;
    };
  }, [username, selectedColor, createChild, handleMouseMove, models]);  // Empty dependency array since it doesn't depend on any props/state

  // Video tamamlandığında çağrılacak fonksiyon
  const handleVideoComplete = () => {
    setShowVideo(false);
    setShowReward(true);

    // 3 saniye sonra ödül bildirimini kaldır
    if (rewardTimeoutRef.current) {
      clearTimeout(rewardTimeoutRef.current);
    }
    rewardTimeoutRef.current = setTimeout(() => {
      setShowReward(false);
    }, 3000);
  };

  // Add mobile control handler
  const handleMobileControl = (key) => {
    const event = {
      key,
      code: key === 'Space' ? 'Space' : key,
    };
    
    if (window.moveChild) {
      window.moveChild(event);
    }
  };

  // Mobile controls render
  const renderMobileControls = () => {
    return (
      <div className="mobile-controls">
        <div className="mobile-dpad">
          <button className="mobile-button" onTouchStart={() => handleMobileControl('ArrowUp')}>⬆</button>
          <button className="mobile-button" onTouchStart={() => handleMobileControl('ArrowLeft')}>⬅</button>
          <button className="mobile-button" onTouchStart={() => handleMobileControl('ArrowRight')}>➡</button>
          <button className="mobile-button" onTouchStart={() => handleMobileControl('ArrowDown')}>⬇</button>
        </div>
        <button className="mobile-button mobile-jump" onTouchStart={() => handleMobileControl('Space')}>⬆</button>
      </div>
    );
  };

  // Add language toggle button
  const renderLanguageButton = () => {
    return (
      <button
        className="language-button"
        onClick={toggleLanguage}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '8px 16px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: '1px solid white',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        {language === 'en' ? 'TR' : 'EN'}
      </button>
    );
  };

  if (!isLoggedIn) {
    return <LoginForm />;
  }

  return (
    <div className="App">
      {renderLanguageButton()}
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      />
      <canvas 
        ref={uiCanvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
        onClick={handleCanvasClick}
      />
      {renderMobileControls()}
      {showVideo && (
        <VideoPlayer
          onComplete={handleVideoComplete}
        />
      )}
    </div>
  );
}

// Wrap the Game component with Router
function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/:roomId" element={<Game />} />
          <Route path="/:roomId/:username" element={<Portfolio />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

// Export App instead of Game
export default App;
