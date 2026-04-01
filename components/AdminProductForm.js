'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/compressImage'
import { X, Save, Upload, Loader2, Layers, Image as ImageIcon, Zap, Gift, Plus } from 'lucide-react'

export default function AdminProductForm({ productToEdit, onCancel, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Estados del Formulario
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('') 
  const [stock, setStock] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [offerId, setOfferId] = useState('') 
  const [imageUrl, setImageUrl] = useState('')
  const [imageToDelete, setImageToDelete] = useState(null)
  const [promoTags, setPromoTags] = useState([]) 
  const [customTag, setCustomTag] = useState('') 
  const [isActive, setIsActive] = useState(true)
  
  // Estados de Datos
  const [categories, setCategories] = useState([])
  const [modifierGroups, setModifierGroups] = useState([])
  const [selectedModifiers, setSelectedModifiers] = useState([])
  const [availableOffers, setAvailableOffers] = useState([])

  // Estado para DnD de Extras
  const [draggedGroupIdx, setDraggedGroupIdx] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('*').order('id')
      if (cats) {
          setCategories(cats)
          if (!productToEdit && cats.length > 0) setCategoryId(cats[0].id)
      }
      const { data: groups } = await supabase.from('modifier_groups').select('*').order('id')
      if (groups) setModifierGroups(groups)

      const { data: offers } = await supabase.from('special_offers').select('*').eq('is_active', true)
      if (offers) setAvailableOffers(offers)

      if (productToEdit) {
        setName(productToEdit.name || ''); setDescription(productToEdit.description || ''); setPrice(productToEdit.price || '');
        setCostPrice(productToEdit.cost_price || ''); setCategoryId(productToEdit.category_id || '');
        setStock(productToEdit.stock !== undefined && productToEdit.stock !== null ? productToEdit.stock : '');
        setOfferId(productToEdit.offer_id || ''); setImageUrl(productToEdit.image_url || ''); setIsActive(productToEdit.is_active);
        
        if (productToEdit.promo_tag) {
            setPromoTags(productToEdit.promo_tag.split(',').map(tag => tag.trim()).filter(tag => tag !== ""))
        } else { setPromoTags([]) }

        // Fetch de modificadores existentes ordenados
        const { data: existingModifiers } = await supabase.from('product_modifiers').select('group_id, position').eq('product_id', productToEdit.id).order('position', { ascending: true })
        if (existingModifiers) setSelectedModifiers(existingModifiers.map(em => em.group_id))
      }
    }
    fetchData()
  }, [productToEdit])

  const handleImageUpload = async (e) => {
    try {
      setUploading(true)
      const file = e.target.files[0]
      if (!file) return
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.8 })
      const fileName = `${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, compressed, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName)
      if (imageUrl) setImageToDelete(imageUrl)
      setImageUrl(data.publicUrl)
    } catch (error) { alert('Error imagen: ' + error.message) } finally { setUploading(false) }
  }

  // --- NATIVE DRAG & DROP PARA GRUPOS ---
  const handleDragStartGroup = (e, index) => {
    setDraggedGroupIdx(index)
    e.dataTransfer.effectAllowed = "move"
    setTimeout(() => { if(e.target) e.target.classList.add('opacity-50') }, 0)
  }
  const handleDragEndGroup = (e) => {
    if(e.target) e.target.classList.remove('opacity-50')
    setDraggedGroupIdx(null)
  }
  const handleDragOverGroup = (e) => e.preventDefault()
  const handleDropGroup = (e, dropIndex) => {
    e.preventDefault()
    if (draggedGroupIdx === null || draggedGroupIdx === dropIndex) return
    const newItems = [...selectedModifiers]
    const draggedItem = newItems.splice(draggedGroupIdx, 1)[0]
    newItems.splice(dropIndex, 0, draggedItem)
    setSelectedModifiers(newItems)
  }

  const handleSave = async () => {
    if (!name || !price) return alert('Falta nombre o precio.')
    setLoading(true)
    try {
      const tagsString = promoTags.length > 0 ? promoTags.join(', ') : null
      const productData = {
        name, description, price: parseFloat(price), cost_price: costPrice ? parseFloat(costPrice) : null,
        stock: stock !== '' ? parseInt(stock) : null,
        category_id: categoryId, offer_id: offerId || null, image_url: imageUrl, promo_tag: tagsString, is_active: isActive
      }

      let productId = productToEdit?.id
      if (productToEdit) {
        await supabase.from('products').update(productData).eq('id', productId)
      } else {
        const { data, error } = await supabase.from('products').insert([productData]).select()
        if (error) throw error
        productId = data[0].id
      }

      // Reasignación de Extras con Posición
      if (productId) {
          await supabase.from('product_modifiers').delete().eq('product_id', productId)
          if (selectedModifiers.length > 0) {
            await supabase.from('product_modifiers').insert(selectedModifiers.map((groupId, idx) => ({ product_id: productId, group_id: groupId, position: idx })))
          }
      }

      if (imageToDelete) {
          const oldName = imageToDelete.split('/menu-images/')[1]
          if (oldName) await supabase.storage.from('menu-images').remove([oldName])
      }

      setTimeout(() => onSaved(), 100)
    } catch (error) { alert('Error: ' + error.message); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FAF7F2]/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl border border-[#4A3B32]/10 shadow-2xl flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-[#4A3B32]/10 bg-white z-10">
          <h2 className="text-xl font-bold text-[#4A3B32] uppercase italic">{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button type="button" onClick={onCancel} className="text-[#4A3B32]/70 hover:text-[#4A3B32]"><X /></button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar flex-1">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Foto</label>
                        <div className="relative overflow-hidden bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-xl aspect-square flex items-center justify-center group cursor-pointer hover:border-[#4A3B32]/40 transition">
                            {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" /> : <div className="text-[#4A3B32]/60 flex flex-col items-center">{uploading ? <Loader2 className="animate-spin mb-2"/> : <Upload size={32} className="mb-2"/>}<span className="text-xs font-bold uppercase">Subir Foto</span></div>}
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                        </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-[#4A3B32]/10/50">
                        <label className="text-xs font-bold text-green-500 uppercase flex items-center gap-1 tracking-widest"><Zap size={14}/> Etiquetas</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {['NUEVO', 'VEGANO', 'SIN TACC', 'PICANTE'].map(tag => (
                                <button key={tag} type="button" onClick={() => setPromoTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])} className={`text-[9px] font-black px-2 py-1.5 rounded border transition-all ${promoTags.includes(tag) ? 'bg-green-600 text-[#4A3B32] border-green-600' : 'bg-[#FAF7F2] text-[#4A3B32]/60 border-[#4A3B32]/20 hover:border-[#4A3B32]/40'}`}>{tag}</button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Agregar etiqueta..." value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setPromoTags(p => [...new Set([...p, customTag.toUpperCase()])]), setCustomTag(''))} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-2 text-[10px] text-[#4A3B32] outline-none focus:border-green-600" />
                        </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-[#4A3B32]/10/50">
                        <label className="text-xs font-bold text-yellow-500 uppercase flex items-center gap-1 tracking-widest"><Gift size={14}/> Vincular Promo</label>
                        <select value={offerId} onChange={e => setOfferId(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-yellow-500 text-xs font-bold">
                            <option value="">Sin Promoción</option>
                            {availableOffers.map(off => <option key={off.id} value={off.id}>{off.title} ({off.discount_value})</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Nombre</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 font-bold" /></div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Venta</label><input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 font-black" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Costo</label><input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 font-black" placeholder="0.00" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Stock</label><input type="number" step="1" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 font-black" placeholder="Ilimitado" /></div>
                    </div>
                    <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Categoría</label><select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 text-xs font-bold">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-[#4A3B32]/70 uppercase tracking-widest">Descripción</label><textarea rows="3" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#FAF7F2] border border-[#4A3B32]/20 rounded-lg p-3 text-[#4A3B32] outline-none focus:border-red-600 text-xs resize-none" /></div>
                    
                    {/* DRAG AND DROP EXTRAS EN PRODUCT FORM */}
                    <div className="space-y-4 pt-4 border-t border-[#4A3B32]/10">
                        <div>
                          <label className="text-xs font-bold text-blue-400 uppercase flex justify-between items-center gap-2 tracking-widest mb-2"><span className="flex items-center gap-1"><Layers size={14}/> Extras Permitidos</span> <span className="text-[9px] text-blue-400/60 lowercase italic">Arrastra para ordenar</span></label>
                          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                            {selectedModifiers.map((groupId, idx) => {
                               const group = modifierGroups.find(g => g.id === groupId);
                               if(!group) return null;
                               return (
                                  <div key={group.id} draggable="true" onDragStart={(e)=>handleDragStartGroup(e, idx)} onDragOver={handleDragOverGroup} onDrop={(e)=>handleDropGroup(e, idx)} onDragEnd={handleDragEndGroup} className="flex items-center justify-between gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition select-none bg-blue-900/10 border-blue-500 hover:border-blue-400 hover:shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="text-blue-500/50"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
                                        <div><span className="text-[11px] font-bold uppercase text-[#4A3B32]">{group.name}</span> <span className="text-[9px] block text-[#4A3B32]/60 uppercase">{group.min_selection===1 && group.max_selection===1 ? 'Radio':'Checkbox'}</span></div>
                                      </div>
                                      <button type="button" onClick={() => setSelectedModifiers(p => p.filter(id => id !== group.id))} className="text-red-500 bg-red-50 w-6 h-6 rounded-full flex items-center justify-center font-bold hover:bg-red-500 hover:text-white transition">×</button>
                                  </div>
                               )
                            })}
                            {selectedModifiers.length === 0 && <div className="text-center p-3 text-xs text-[#4A3B32]/40 italic border border-dashed rounded-lg bg-[#FAF7F2]">Ningún extra asignado.</div>}
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-[#4A3B32]/5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar p-1">
                             {modifierGroups.filter(g => !selectedModifiers.includes(g.id)).map(group => (
                                <div key={group.id} onClick={() => setSelectedModifiers(p => [...p, group.id])} className="flex flex-col p-2.5 rounded-lg border cursor-pointer transition select-none bg-[#FAF7F2] border-[#4A3B32]/10 text-[#4A3B32]/60 hover:border-[#4A3B32]/30 hover:bg-white hover:shadow-sm">
                                   <div className="flex justify-between items-center"><span className="text-[11px] font-bold uppercase">{group.name}</span> <Plus size={14} className="opacity-50" /></div>
                                </div>
                             ))}
                          </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
        <div className="p-6 border-t border-[#4A3B32]/10 flex justify-end gap-3 bg-white z-10">
            <button type="button" onClick={onCancel} className="px-4 py-2 font-bold text-[#4A3B32]/70 hover:text-[#4A3B32] transition text-xs uppercase">Cancelar</button>
            <button onClick={handleSave} disabled={loading || uploading} className="px-8 py-3 bg-[#4A3B32] text-[#FAF7F2] rounded-xl font-black text-xs uppercase hover:bg-black transition shadow-lg flex items-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}<span>Confirmar</span></button>
        </div>
      </div>
    </div>
  )
}