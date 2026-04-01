import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { GripVertical, Layers, Check, Plus } from 'lucide-react';

export default function ProductExtrasSelector({ productId }) {
  const [allGroups, setAllGroups] = useState([]);
  const [activeGroupIds, setActiveGroupIds] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);

  async function loadData() {
    const { data: groups } = await supabase.from('modifier_groups').select('*');
    setAllGroups(groups || []);

    if (productId) {
      const { data: relations } = await supabase
        .from('product_modifiers')
        .select('group_id, position')
        .eq('product_id', productId)
        .order('position', { ascending: true, nullsFirst: false });
      
      if (relations) {
        setActiveGroupIds(relations.map(r => r.group_id));
      }
    }
  }

  useEffect(() => {
    loadData();
  }, [productId]);

  const toggleGroup = async (groupId) => {
    const isSelected = activeGroupIds.includes(groupId);

    if (isSelected) {
      // BORRAR relación
      await supabase
        .from('product_modifiers')
        .delete()
        .match({ product_id: productId, group_id: groupId });
        
      setActiveGroupIds(prev => prev.filter(id => id !== groupId));
    } else {
      // CREAR relación (al final)
      const newPosition = activeGroupIds.length;
      await supabase
        .from('product_modifiers')
        .insert({ product_id: productId, group_id: groupId, position: newPosition });
        
      setActiveGroupIds(prev => [...prev, groupId]);
    }
  };

  // --- NATIVE DRAG & DROP ---
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { if (e.target) e.target.classList.add('opacity-50', 'scale-[0.98]') }, 0);
  };

  const handleDragEnd = (e) => {
    if (e.target) e.target.classList.remove('opacity-50', 'scale-[0.98]');
    setDraggedIdx(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;

    // Actualizamos localmente el estado
    const newItems = [...activeGroupIds];
    const draggedItem = newItems.splice(draggedIdx, 1)[0];
    newItems.splice(dropIndex, 0, draggedItem);
    
    setActiveGroupIds(newItems);

    // Actualizamos la base de datos secuencialmente para que no falle el constraint de pk
    // Es más seguro hacer update individual si no tenemos claro si upsert choca
    for (let i = 0; i < newItems.length; i++) {
        await supabase
          .from('product_modifiers')
          .update({ position: i })
          .match({ product_id: productId, group_id: newItems[i] });
    }
  };

  if (!productId) return <p className="text-sm text-[#4A3B32]/60 mt-4 italic text-center p-4 border border-dashed rounded-xl">Guarda el producto primero para asignarle extras.</p>;

  const activeGroupsList = activeGroupIds.map(id => allGroups.find(g => g.id === id)).filter(Boolean);
  const inactiveGroupsList = allGroups.filter(g => !activeGroupIds.includes(g.id));

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#4A3B32]/10 mt-6 shadow-sm">
      <h3 className="font-black text-[#4A3B32] mb-1 flex items-center gap-2">
         <Layers size={18} /> ASIGNAR EXTRAS
      </h3>
      <p className="text-xs text-[#4A3B32]/60 mb-5">Elige los modificadores de este producto y arrástralos para definir el orden en que los verá el cliente.</p>

      {/* LISTA DE ACTIVOS (ARRASTRABLES) */}
      <div className="mb-6">
        <h4 className="text-[10px] font-bold text-[#4A3B32] uppercase tracking-widest mb-3 border-b border-[#4A3B32]/10 pb-1 flex items-center justify-between">
          <span>Extras Permitidos</span>
          <span className="text-[#4A3B32]/40 lowercase italic font-medium">Arrastra para ordenar</span>
        </h4>
        {activeGroupsList.length === 0 ? (
           <div className="bg-[#FAF7F2] p-4 rounded-xl text-center text-xs text-[#4A3B32]/50 italic border border-[#4A3B32]/10">Ningún extra asignado aún. Selecciona de la lista de abajo.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {activeGroupsList.map((group, idx) => (
              <div 
                key={group.id} 
                draggable="true"
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-200 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all group shadow-sm relative overflow-hidden"
              >
                <div className="flex items-center gap-3 relative z-10 w-full">
                  <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-100 text-blue-600/50 group-hover:text-blue-600 group-hover:bg-blue-200 transition-colors shrink-0">
                     <GripVertical size={16} />
                  </div>
                  <div className="flex-1">
                    <span className="font-black text-[#4A3B32] text-sm block leading-none">{group.name}</span>
                    <span className="text-[9px] text-[#4A3B32]/60 font-bold uppercase tracking-wide mt-1 block">
                      {group.min_selection === 1 && group.max_selection === 1 ? 'Radio' : 'Checkbox'}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 flex items-center justify-center shrink-0 ml-4">
                  <div className="w-8 h-8 rounded border flex items-center justify-center bg-blue-500 border-blue-500 shadow-inner group-hover:hidden transition-all">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                  <button 
                    onClick={() => toggleGroup(group.id)} 
                    className="w-8 h-8 rounded border border-red-300 items-center justify-center bg-white text-red-500 hover:bg-red-50 hover:text-red-500 hover:border-red-400 transition-colors hidden group-hover:flex"
                    title="Quitar de este producto"
                  >
                    <span className="text-sm font-black">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LISTA DE DISPONIBLES */}
      {inactiveGroupsList.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-[#4A3B32]/50 uppercase tracking-widest mb-3 border-b border-[#4A3B32]/10 pb-1">Seleccionar Más Extras</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inactiveGroupsList.map(group => (
              <div 
                key={group.id} 
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between p-3 rounded-lg bg-[#FAF7F2] border border-[#4A3B32]/10 cursor-pointer hover:border-[#4A3B32]/30 hover:bg-white hover:shadow-sm transition-all group"
              >
                <div className="flex-1 pr-2">
                  <span className="font-bold text-[#4A3B32]/80 group-hover:text-[#4A3B32] text-sm">{group.name}</span>
                </div>
                <div className="w-6 h-6 rounded-md border border-[#4A3B32]/20 flex items-center justify-center text-[#4A3B32]/40 group-hover:text-blue-500 group-hover:border-blue-400 group-hover:bg-blue-50/50 bg-white transition-colors shrink-0">
                  <Plus size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}